const express = require('express');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const config = require('./config');

const app = express();
// Çevre değişkenleri üretim/container ortamında config'i geçersiz kılar
const PORT = parseInt(process.env.PORT) || config.server.port;
if (process.env.API_TIMEOUT) config.api.timeout = parseInt(process.env.API_TIMEOUT);
if (process.env.REFRESH_MS) config.refresh.dashboardMs = parseInt(process.env.REFRESH_MS);

// ========================================
// VERİ ÖNBELLEK VE SİNYAL GEÇMİŞİ
// ========================================

let dataCache = {
    data: null,
    timestamp: 0
};

let signalHistory = [];
const SIGNAL_HISTORY_FILE = path.join(__dirname, config.signalHistory.filePath);

// Sinyal geçmişini dosyadan yükle
try {
    if (fs.existsSync(SIGNAL_HISTORY_FILE)) {
        const raw = fs.readFileSync(SIGNAL_HISTORY_FILE, 'utf8');
        signalHistory = JSON.parse(raw);
        if (!Array.isArray(signalHistory)) signalHistory = [];
        console.log(`  Sinyal geçmişi yüklendi: ${signalHistory.length} kayıt`);
    }
} catch (e) {
    console.log('  Sinyal geçmişi yüklenemedi (ilk çalıştırma olabilir):', e.message);
    signalHistory = [];
}

function appendSignal(signalEntry) {
    if (!config.signalHistory.enabled) return;
    signalEntry.timestamp = Date.now();
    signalEntry.serverTime = new Date().toISOString();
    signalHistory.push(signalEntry);
    if (signalHistory.length > config.signalHistory.maxEntries) {
        signalHistory = signalHistory.slice(-config.signalHistory.maxEntries);
    }
    try {
        const dir = path.dirname(SIGNAL_HISTORY_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(SIGNAL_HISTORY_FILE, JSON.stringify(signalHistory, null, 2));
    } catch (e) {
        console.error('Sinyal kaydı yazılamadı:', e.message);
    }
}

// ========================================
// EXPRESS KURULUMU
// ========================================

app.use(express.json()); // JSON body parser (signal loglama için)

// İstek loglama
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const ms = Date.now() - start;
        if (res.statusCode < 400) {
            console.log(`${req.method} ${req.url} → ${res.statusCode} (${ms}ms)`);
        } else {
            console.log(`⚠️ ${req.method} ${req.url} → ${res.statusCode} (${ms}ms)`);
        }
    });
    next();
});

// CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    next();
});

// Statik dosyalar
app.use(express.static(path.join(__dirname)));

// Favicon
app.get('/favicon.ico', (req, res) => res.status(204).end());

// ========================================
// SAĞLIK VE YAPILANDIRMA ENDPOINT'LERİ
// ========================================

// Health check - uygulama canlılık kontrolü
app.get('/api/health', (req, res) => {
    const now = Date.now();
    const cacheAge = dataCache.data ? (now - dataCache.timestamp) / 1000 : -1;
    const isStale = cacheAge > config.refresh.dataStaleMs / 1000;
    res.json({
        status: 'ok',
        uptime: process.uptime(),
        cacheAge: Math.round(cacheAge) + 's',
        cacheStale: isStale,
        signalCount: signalHistory.length,
        lastSignal: signalHistory.length > 0 ? signalHistory[signalHistory.length - 1] : null,
        timestamp: now
    });
});

// Yapılandırmayı client'a gönder (sadece client tarafından kullanılan kısım)
app.get('/api/config', (req, res) => {
    res.json({
        signalThresholds: config.signalThresholds,
        categoryWeights: config.categoryWeights,
        timeframeWeights: (() => {
            const w = {};
            for (const [tf, v] of Object.entries(config.timeframes)) w[tf] = v.weight;
            return w;
        })(),
        refreshMs: config.refresh.dashboardMs,
        advanced: config.advanced,
        confidence: config.confidence
    });
});

// Sinyal geçmişi
app.get('/api/signal-history', (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    if (isNaN(limit) || limit < 1) return res.json([]);
    res.json(signalHistory.slice(-limit));
});

// Sinyal kaydet (client tarafından POST ile gönderilir)
app.post('/api/log-signal', (req, res) => {
    try {
        const signal = req.body;
        if (!signal || !signal.signal) {
            return res.status(400).json({ error: 'Geçersiz sinyal verisi' });
        }
        // FIX: Sadece gerekli alanları al, client internal alanlarını (_loggedAt vb.) atla
        const { signal: sig, confidence, weightedScore, breakdown, tfAlignment, regime, grade, price, multiTf } = signal;
        appendSignal({
            signal: sig,
            confidence: confidence,
            weightedScore: weightedScore,
            breakdown: breakdown || {},
            tfAlignment: tfAlignment || 'unknown',
            regime: regime || 'Unknown',
            grade: grade || 'NT',
            price: price || null,
            multiTf: multiTf || {}
        });
        res.json({ status: 'ok', count: signalHistory.length });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Sinyal istatistikleri
app.get('/api/signal-stats', (req, res) => {
    const stats = {
        total: signalHistory.length,
        buy: 0,
        sell: 0,
        neutral: 0,
        avgConfidence: 0,
        last24h: 0,
        buy24h: 0,
        sell24h: 0
    };
    const cutoff = Date.now() - 86400000; // 24 saat
    for (const s of signalHistory) {
        if (s.signal === 'BUY') stats.buy++;
        else if (s.signal === 'SELL') stats.sell++;
        else stats.neutral++;
        if (s.timestamp && s.timestamp > cutoff) {
            stats.last24h++;
            if (s.signal === 'BUY') stats.buy24h++;
            else if (s.signal === 'SELL') stats.sell24h++;
        }
    }
    stats.avgConfidence = signalHistory.length > 0
        ? signalHistory.reduce((a, s) => a + (s.confidence || 0), 0) / signalHistory.length
        : 0;
    res.json(stats);
});

// ========================================
// PROXY ENDPOINT'LERİ
// ========================================

// Tüm verileri tek seferde getir (önbellekli)
app.get('/api/all', async (req, res) => {
    try {
        const fetchSafe = async (url, headers = {}) => {
            try {
                return await fetchJson(url, headers);
            } catch (e) {
                console.error('API hatası:', url, e.message.substring(0, 100));
                return { error: e.message, code: 'ERROR' };
            }
        };

        const [ticker, orderbook, candles1h, candles15m, candles4h, coingecko] = await Promise.all([
            fetchSafe(`${config.api.kucoinBase}/market/stats?symbol=${config.api.symbol}`),
            fetchSafe(`${config.api.kucoinBase}/market/orderbook/level1?symbol=${config.api.symbol}`),
            fetchSafe(`${config.api.kucoinBase}/market/candles?symbol=${config.api.symbol}&type=1hour&limit=${config.api.maxCandles}`),
            fetchSafe(`${config.api.kucoinBase}/market/candles?symbol=${config.api.symbol}&type=15min&limit=${config.api.maxCandles}`),
            fetchSafe(`${config.api.kucoinBase}/market/candles?symbol=${config.api.symbol}&type=4hour&limit=${config.api.maxCandles}`),
            fetchSafe(
                `${config.api.coingeckoBase}/simple/price?ids=${config.api.coingeckoId}&vs_currencies=usd&include_24hr_vol=true&include_24hr_change=true&include_market_cap=true`,
                { 'User-Agent': 'Mozilla/5.0' }
            )
        ]);

        const responseData = { ticker, orderbook, candles1h, candles15m, candles4h, coingecko };

        // Önbelleğe al (en az bir başarılı veri varsa)
        const hasValidData = ticker && ticker.code === '200000';
        if (hasValidData) {
            dataCache.data = responseData;
            dataCache.timestamp = Date.now();
        }

        res.json(responseData);

    } catch (e) {
        console.error('/api/all hatası:', e.message);

        // Önbellekte veri varsa onu döndür
        if (dataCache.data && dataCache.data.ticker) {
            console.log('⚠️ Önbellekteki veri döndürülüyor (yaş: ' +
                Math.round((Date.now() - dataCache.timestamp) / 1000) + 's)');
            return res.json({
                ...dataCache.data,
                _cached: true,
                _cachedAge: Math.round((Date.now() - dataCache.timestamp) / 1000)
            });
        }

        res.status(500).json({
            error: 'API hatası: ' + e.message,
            code: 'ERROR'
        });
    }
});

// KuCoin Ticker (bireysel)
app.get('/api/kucoin/ticker', async (req, res) => {
    try {
        const data = await fetchJson(`${config.api.kucoinBase}/market/stats?symbol=${config.api.symbol}`);
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// KuCoin Mum verileri
app.get('/api/kucoin/candles', async (req, res) => {
    try {
        const type = req.query.type || '1hour';
        const limit = req.query.limit || config.api.maxCandles;
        const data = await fetchJson(`${config.api.kucoinBase}/market/candles?symbol=${config.api.symbol}&type=${type}&limit=${limit}`);
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// CoinGecko
app.get('/api/coingecko/price', async (req, res) => {
    try {
        const data = await fetchJson(
            `${config.api.coingeckoBase}/simple/price?ids=${config.api.coingeckoId}&vs_currencies=usd&include_24hr_vol=true&include_24hr_change=true&include_market_cap=true`,
            { 'User-Agent': 'Mozilla/5.0' }
        );
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ========================================
// HTTP İSTEK YARDIMCISI
// ========================================

async function fetchJson(url, extraHeaders = {}) {
    return new Promise((resolve, reject) => {
        const u = new URL(url);
        const isHttps = u.protocol === 'https:';
        const mod = isHttps ? https : http;
        const opts = {
            hostname: u.hostname,
            port: u.port || (isHttps ? 443 : 80),
            path: u.pathname + u.search,
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json',
                ...extraHeaders
            },
            rejectUnauthorized: false
        };

        const req = mod.request(opts, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error('JSON parse error from ' + url + ': ' + data.substring(0, 300)));
                }
            });
        });
        req.on('error', reject);
        req.setTimeout(config.api.timeout, () => {
            req.destroy();
            reject(new Error('Request timeout: ' + url));
        });
        req.end();
    });
}

// ========================================
// ANA SAYFA VE BAŞLATMA
// ========================================

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.listen(PORT, config.server.host, () => {
    console.log(`=============================================`);
    console.log(`  ZBCNUSDT Sinyal Dashboard`);
    console.log(`  http://localhost:${PORT}`);
    console.log(`=============================================`);
    console.log(`  Sunucu: ${config.server.host}:${PORT}`);
    console.log(`  Önbellek: aktif`);
    console.log(`  Sinyal geçmişi: ${signalHistory.length} kayıt`);
    console.log(`  Yenileme: ${config.refresh.dashboardMs / 1000}s`);
    console.log(`  API timeout: ${config.api.timeout / 1000}s`);
    console.log(`=============================================`);
});
