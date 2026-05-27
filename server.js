const express = require('express');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const config = require('./config');
const { PaperTradingEngine, RiskManager, DataValidator } = require('./core');
const { retryManager } = require('./utils/retry');
const { sendTelegramMessage, sendDiscordMessage } = require('./utils/webhook');

const app = express();
const PORT = parseInt(process.env.PORT) || config.server.port;
if (process.env.API_TIMEOUT) config.api.timeout = parseInt(process.env.API_TIMEOUT);
if (process.env.REFRESH_MS) config.refresh.dashboardMs = parseInt(process.env.REFRESH_MS);

// Load environment variables for alerts
if (process.env.ALERTS_ENABLED) config.alerts.enabled = process.env.ALERTS_ENABLED === 'true';
if (process.env.TELEGRAM_ENABLED) config.alerts.telegram.enabled = process.env.TELEGRAM_ENABLED === 'true';
if (process.env.TELEGRAM_TOKEN) config.alerts.telegram.token = process.env.TELEGRAM_TOKEN;
if (process.env.TELEGRAM_CHAT_ID) config.alerts.telegram.chatId = process.env.TELEGRAM_CHAT_ID;
if (process.env.DISCORD_ENABLED) config.alerts.discord.enabled = process.env.DISCORD_ENABLED === 'true';
if (process.env.DISCORD_WEBHOOK_URL) config.alerts.discord.webhookUrl = process.env.DISCORD_WEBHOOK_URL;

// ========================================
// FIX: trust proxy - rate limiting için doğru IP
// ========================================
app.set('trust proxy', 1);

// ========================================
// ÇOKLU SEMBOL DESTEĞİ
// ========================================

const symbols = config.symbols;
const activeSymbols = Object.keys(symbols);

// Her sembol için ayrı cache
const dataCaches = {};
for (const sym of activeSymbols) {
    dataCaches[sym] = { data: null, timestamp: 0 };
}

// Her sembol için ayrı sinyal geçmişi
const signalHistories = {};
const SIGNAL_HISTORY_DIR = path.join(__dirname, 'data');

// Sinyal geçmişlerini yükle
for (const sym of activeSymbols) {
    try {
        const f = path.join(SIGNAL_HISTORY_DIR, `signals_${sym}.json`);
        if (fs.existsSync(f)) {
            const raw = fs.readFileSync(f, 'utf8');
            signalHistories[sym] = JSON.parse(raw);
            if (!Array.isArray(signalHistories[sym])) signalHistories[sym] = [];
            console.log(`  ${sym} sinyal geçmişi yüklendi: ${signalHistories[sym].length} kayıt`);
        } else {
            signalHistories[sym] = [];
        }
    } catch (e) {
        console.log(`  ${sym} sinyal geçmişi yüklenemedi:`, e.message);
        signalHistories[sym] = [];
    }
}

async function triggerAlerts(symbol, signalEntry) {
    if (!config.alerts.enabled) return;

    const message = `🚨 <b>YENİ SİNYAL: ${symbol}</b> 🚨\n\n` +
        `📊 <b>Sinyal</b>: ${signalEntry.signal}\n` +
        `🎯 <b>Fiyat</b>: $${signalEntry.price}\n` +
        `📈 <b>Güven Skoru</b>: %${signalEntry.confidence}\n` +
        `📉 <b>Ağırlıklı Skor</b>: ${signalEntry.weightedScore}\n` +
        `🌡️ <b>Piyasa Rejimi</b>: ${signalEntry.regime}\n` +
        `🏷️ <b>İşlem Notu</b>: ${signalEntry.grade}\n` +
        `⏱️ <b>Zaman Uyum</b>: ${signalEntry.tfAlignment}\n\n` +
        `🤖 Generated with Pochi | ZBCNUSDT Signal Terminal`;

    // Telegram
    if (config.alerts.telegram.enabled && config.alerts.telegram.token && config.alerts.telegram.chatId) {
        try {
            await sendTelegramMessage(config.alerts.telegram.token, config.alerts.telegram.chatId, message);
            console.log(`[ALERT] Telegram bildirimi gönderildi: ${symbol} - ${signalEntry.signal}`);
        } catch (e) {
            console.error('[ALERT] Telegram bildirim hatası:', e.message);
        }
    }

    // Discord
    if (config.alerts.discord.enabled && config.alerts.discord.webhookUrl) {
        try {
            const cleanMessage = message.replace(/<[^>]*>/g, ''); // Strip HTML for Discord
            await sendDiscordMessage(config.alerts.discord.webhookUrl, cleanMessage);
            console.log(`[ALERT] Discord bildirimi gönderildi: ${symbol} - ${signalEntry.signal}`);
        } catch (e) {
            console.error('[ALERT] Discord bildirim hatası:', e.message);
        }
    }
}

function appendSignal(symbol, signalEntry) {
    if (!config.signalHistory.enabled) return;
    const hist = signalHistories[symbol];
    if (!hist) return;
    signalEntry.timestamp = Date.now();
    signalEntry.serverTime = new Date().toISOString();
    signalEntry.symbol = symbol;
    hist.push(signalEntry);
    if (hist.length > config.signalHistory.maxEntries) {
        signalHistories[symbol] = hist.slice(-config.signalHistory.maxEntries);
    }
    try {
        if (!fs.existsSync(SIGNAL_HISTORY_DIR)) fs.mkdirSync(SIGNAL_HISTORY_DIR, { recursive: true });
        fs.writeFileSync(path.join(SIGNAL_HISTORY_DIR, `signals_${symbol}.json`), JSON.stringify(signalHistories[symbol], null, 2));
        
        // Sinyal başarıyla kaydedildiğinde alarm tetikle
        triggerAlerts(symbol, signalEntry);
    } catch (e) {
        console.error(`${symbol} sinyal kaydı yazılamadı:`, e.message);
    }
}

// ========================================
// EXPRESS KURULUMU
// ========================================

app.use(express.json());

// Rate limiting
const rateLimit = require('express-rate-limit');
const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 200,
    message: { error: 'Çok fazla istek, lütfen daha sonra tekrar deneyin.' }
});
app.use('/api/', limiter);

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
    res.header('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGINS || '*');
    res.header('Access-Control-Allow-Headers', process.env.ALLOWED_HEADERS || '*');
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

app.get('/api/health', (req, res) => {
    const now = Date.now();
    const cacheInfo = {};
    for (const sym of activeSymbols) {
        const c = dataCaches[sym];
        const age = c.data ? (now - c.timestamp) / 1000 : -1;
        cacheInfo[sym] = { cacheAge: Math.round(age) + 's', cacheStale: age > config.refresh.dataStaleMs / 1000 };
    }
    res.json({
        status: 'ok',
        uptime: process.uptime(),
        activeSymbols,
        cacheInfo,
        signalCounts: Object.fromEntries(activeSymbols.map(s => [s, (signalHistories[s] || []).length])),
        timestamp: now
    });
});

app.get('/api/config', (req, res) => {
    res.json({
        symbols: Object.fromEntries(
            Object.entries(config.symbols).map(([k, v]) => [k, {
                kucoinSymbol: v.kucoinSymbol,
                coingeckoId: v.coingeckoId,
                label: v.label,
                coinName: v.coinName
            }])
        ),
        activeSymbol: config.activeSymbol,
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

app.get('/api/signal-history', (req, res) => {
    const symbol = req.query.symbol || config.activeSymbol;
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    if (isNaN(limit) || limit < 1) return res.json([]);
    const hist = signalHistories[symbol] || [];
    res.json(hist.slice(-limit));
});

app.post('/api/log-signal', (req, res) => {
    try {
        const signal = req.body;
        if (!signal || !signal.signal) {
            return res.status(400).json({ error: 'Geçersiz sinyal verisi' });
        }
        const symbol = signal.symbol || config.activeSymbol;
        const { signal: sig, confidence, weightedScore, breakdown, tfAlignment, regime, grade, price, multiTf, state } = signal;
        appendSignal(symbol, {
            signal: sig,
            confidence: confidence,
            weightedScore: weightedScore,
            breakdown: breakdown || {},
            tfAlignment: tfAlignment || 'unknown',
            regime: regime || 'Unknown',
            grade: grade || 'NT',
            price: price || null,
            multiTf: multiTf || {},
            state: state || 'WAIT'
        });
        res.json({ status: 'ok', symbol, count: (signalHistories[symbol] || []).length });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/signal-stats', (req, res) => {
    const symbol = req.query.symbol || config.activeSymbol;
    const hist = signalHistories[symbol] || [];
    const stats = {
        total: hist.length, buy: 0, sell: 0, neutral: 0, avgConfidence: 0,
        last24h: 0, buy24h: 0, sell24h: 0
    };
    const cutoff = Date.now() - 86400000;
    for (const s of hist) {
        if (s.signal === 'BUY') stats.buy++;
        else if (s.signal === 'SELL') stats.sell++;
        else stats.neutral++;
        if (s.timestamp && s.timestamp > cutoff) {
            stats.last24h++;
            if (s.signal === 'BUY') stats.buy24h++;
            else if (s.signal === 'SELL') stats.sell24h++;
        }
    }
    stats.avgConfidence = hist.length > 0
        ? hist.reduce((a, s) => a + (s.confidence || 0), 0) / hist.length : 0;
    res.json(stats);
});

// ========================================
// PAPER TRADING - ÇOKLU SEMBOL
// ========================================

const paperTradingEngines = {};
for (const sym of activeSymbols) {
    const symCfg = symbols[sym];
    paperTradingEngines[sym] = new PaperTradingEngine({
        initialBalance: symCfg.paperTradingInitialBalance || config.paperTrading.initialBalance,
        mode: 'paper',
        manualApproval: true,
        stateFile: symCfg.paperTradingStateFile || `./data/paperTrading_${sym}.json`
    });
}

function getPTEngine(symbol) {
    const sym = symbol || config.activeSymbol;
    return paperTradingEngines[sym] || paperTradingEngines[config.activeSymbol];
}

app.get('/api/paper-trading/portfolio', (req, res) => {
    try {
        const sym = req.query.symbol || config.activeSymbol;
        const engine = getPTEngine(sym);
        const summary = engine.getPortfolioSummary();
        summary.symbol = sym;
        res.json(summary);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/paper-trading/positions', (req, res) => {
    try {
        const sym = req.query.symbol || config.activeSymbol;
        const engine = getPTEngine(sym);
        res.json(engine.getOpenPositions());
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/paper-trading/pending', (req, res) => {
    try {
        const sym = req.query.symbol || config.activeSymbol;
        const engine = getPTEngine(sym);
        res.json(engine.getPendingOrders());
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/paper-trading/history', (req, res) => {
    try {
        const sym = req.query.symbol || config.activeSymbol;
        const engine = getPTEngine(sym);
        const limit = Math.min(parseInt(req.query.limit) || 50, 200);
        res.json(engine.getTradeHistory(limit));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/paper-trading/execute', (req, res) => {
    try {
        const { signal, price, confidence, metadata, symbol: reqSymbol } = req.body;
        if (!signal || !price || !confidence) {
            return res.status(400).json({ error: 'Missing required fields: signal, price, confidence' });
        }
        const sym = reqSymbol || config.activeSymbol;
        const engine = getPTEngine(sym);
        const result = engine.executeTrade(signal, parseFloat(price), parseFloat(confidence), { ...(metadata || {}), symbol: sym });
        result.symbol = sym;
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/paper-trading/approve', (req, res) => {
    try {
        const { tradeId } = req.body;
        if (!tradeId) return res.status(400).json({ error: 'Missing tradeId' });
        for (const sym of activeSymbols) {
            const engine = paperTradingEngines[sym];
            const pending = engine.getPendingOrders();
            if (pending.some(t => t.id === tradeId)) {
                const result = engine.approveTrade(tradeId);
                result.symbol = sym;
                return res.json(result);
            }
        }
        res.status(404).json({ error: 'Trade not found' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/paper-trading/reject', (req, res) => {
    try {
        const { tradeId } = req.body;
        if (!tradeId) return res.status(400).json({ error: 'Missing tradeId' });
        for (const sym of activeSymbols) {
            const engine = paperTradingEngines[sym];
            const pending = engine.getPendingOrders();
            if (pending.some(t => t.id === tradeId)) {
                const result = engine.rejectTrade(tradeId);
                result.symbol = sym;
                return res.json(result);
            }
        }
        res.status(404).json({ error: 'Trade not found' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/paper-trading/close', (req, res) => {
    try {
        const { positionId, currentPrice, reason, symbol: reqSymbol } = req.body;
        if (!positionId || !currentPrice) {
            return res.status(400).json({ error: 'Missing required fields: positionId, currentPrice' });
        }
        const sym = reqSymbol || config.activeSymbol;
        const engine = getPTEngine(sym);
        const result = engine.closePosition(positionId, parseFloat(currentPrice), reason || 'manual');
        result.symbol = sym;
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/paper-trading/check-sl-tp', (req, res) => {
    try {
        const { currentPrice, symbol: reqSymbol } = req.body;
        if (!currentPrice) return res.status(400).json({ error: 'Missing currentPrice' });
        const sym = reqSymbol || config.activeSymbol;
        const engine = getPTEngine(sym);
        const results = engine.checkStopLossTakeProfit(parseFloat(currentPrice));
        res.json(results.map(r => ({ ...r, symbol: sym })));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/paper-trading/reset', (req, res) => {
    try {
        const sym = req.body.symbol || config.activeSymbol;
        const engine = getPTEngine(sym);
        const result = engine.reset();
        result.symbol = sym;
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/paper-trading/set-mode', (req, res) => {
    try {
        const { mode, symbol: reqSymbol } = req.body;
        if (!mode || (mode !== 'paper' && mode !== 'live')) {
            return res.status(400).json({ error: 'Invalid mode' });
        }
        const sym = reqSymbol || config.activeSymbol;
        const engine = getPTEngine(sym);
        const result = engine.setMode(mode);
        result.symbol = sym;
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ========================================
// RİSK MANAGEMENT ENDPOINTS
// ========================================

const riskManager = new RiskManager({
    maxPositionSize: 0.1, maxDailyLoss: 0.05, maxOpenPositions: 3,
    defaultStopLoss: 0.05, defaultTakeProfit: 0.10, riskRewardRatio: 2.0, minConfidence: 60
});

const dataValidator = new DataValidator({
    maxGapSize: config.dataValidation?.maxGapSize || 3,
    minCandleCount: config.dataValidation?.minCandleCount || 30,
    timestampTolerance: config.dataValidation?.timestampTolerance || 60000,
    priceTolerance: config.dataValidation?.priceTolerance || 0.01
});

app.get('/api/risk/parameters', (req, res) => {
    try { res.json(riskManager.getRiskParameters()); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/risk/parameters', (req, res) => {
    try { res.json(riskManager.updateRiskParameters(req.body)); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/risk/calculate-position', (req, res) => {
    try {
        const { balance, entryPrice, stopLossPrice, confidence } = req.body;
        if (!balance || !entryPrice || !stopLossPrice) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        const result = riskManager.calculatePositionSize(
            parseFloat(balance), parseFloat(entryPrice), parseFloat(stopLossPrice),
            confidence ? parseFloat(confidence) : 70
        );
        res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/risk/validate-trade', (req, res) => {
    try {
        const { signal, entryPrice, stopLoss, takeProfit, confidence, currentPositions } = req.body;
        if (!signal || !entryPrice || !stopLoss || !takeProfit) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        const result = riskManager.validateTradeSetup(
            signal, parseFloat(entryPrice), parseFloat(stopLoss), parseFloat(takeProfit),
            confidence ? parseFloat(confidence) : 70, currentPositions ? parseInt(currentPositions) : 0
        );
        res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/risk/check-pause', (req, res) => {
    try {
        const balance = parseFloat(req.query.balance) || 10000;
        res.json(riskManager.shouldPauseTrading(balance));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/risk/daily-stats', (req, res) => {
    try { res.json(riskManager.getDailyStats()); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

// ========================================
// PROXY ENDPOINT'LERİ - ÇOKLU SEMBOL + RETRY
// ========================================

app.get('/api/all', async (req, res) => {
    try {
        const symbol = req.query.symbol || config.activeSymbol;
        const symCfg = symbols[symbol];
        if (!symCfg) {
            return res.status(400).json({ error: `Unknown symbol: ${symbol}` });
        }

        const kucoinSym = symCfg.kucoinSymbol;
        const cgId = symCfg.coingeckoId;

        // FIX: fetchSafe retryManager ile sarmalanmış versiyonu kullan
        const fetchSafe = async (url, headers = {}) => {
            try {
                return await retryManager.execute(async () => {
                    return await fetchJson(url, headers);
                }, { context: `API ${symbol}` });
            } catch (e) {
                console.error(`API hatası [${symbol}]:`, url, e.message.substring(0, 100));
                return { error: e.message, code: 'ERROR' };
            }
        };

        const [ticker, orderbook, candles1h, candles15m, candles4h, coingecko] = await Promise.all([
            fetchSafe(`${config.api.kucoinBase}/market/stats?symbol=${kucoinSym}`),
            fetchSafe(`${config.api.kucoinBase}/market/orderbook/level1?symbol=${kucoinSym}`),
            fetchSafe(`${config.api.kucoinBase}/market/candles?symbol=${kucoinSym}&type=1hour&limit=${config.api.maxCandles}`),
            fetchSafe(`${config.api.kucoinBase}/market/candles?symbol=${kucoinSym}&type=15min&limit=${config.api.maxCandles}`),
            fetchSafe(`${config.api.kucoinBase}/market/candles?symbol=${kucoinSym}&type=4hour&limit=${config.api.maxCandles}`),
            fetchSafe(
                `${config.api.coingeckoBase}/simple/price?ids=${cgId}&vs_currencies=usd&include_24hr_vol=true&include_24hr_change=true&include_market_cap=true`,
                { 'User-Agent': 'Mozilla/5.0' }
            )
        ]);

        let validationResult = { valid: true, warnings: [], errors: [] };
        if (candles1h && candles1h.code === '200000' && Array.isArray(candles1h.data)) {
            const parsed1h = [...candles1h.data].reverse().map(c => ({
                time: parseInt(c[0]) * 1000,
                open: parseFloat(c[1]),
                close: parseFloat(c[2]),
                high: parseFloat(c[3]),
                low: parseFloat(c[4]),
                volume: parseFloat(c[5])
            }));
            validationResult = dataValidator.validateCandleData(parsed1h, '1h');
        }

        const responseData = { 
            ticker, 
            orderbook, 
            candles1h, 
            candles15m, 
            candles4h, 
            coingecko, 
            _symbol: symbol,
            _validation: validationResult 
        };

        const hasValidData = ticker && ticker.code === '200000';
        if (hasValidData) {
            dataCaches[symbol] = { data: responseData, timestamp: Date.now() };
        }

        res.json(responseData);

    } catch (e) {
        console.error(`/api/all hatası:`, e.message);
        const sym = req.query.symbol || config.activeSymbol;
        if (dataCaches[sym] && dataCaches[sym].data && dataCaches[sym].data.ticker) {
            console.log(`⚠️ ${sym} önbellekteki veri döndürülüyor (${Math.round((Date.now() - dataCaches[sym].timestamp) / 1000)}s)`);
            return res.json({ ...dataCaches[sym].data, _cached: true, _cachedAge: Math.round((Date.now() - dataCaches[sym].timestamp) / 1000) });
        }
        res.status(500).json({ error: 'API hatası: ' + e.message, code: 'ERROR' });
    }
});

app.get('/api/kucoin/ticker', async (req, res) => {
    try {
        const symbol = req.query.symbol || config.activeSymbol;
        const symCfg = symbols[symbol];
        if (!symCfg) return res.status(400).json({ error: `Unknown symbol: ${symbol}` });
        const data = await retryManager.execute(() => fetchJson(`${config.api.kucoinBase}/market/stats?symbol=${symCfg.kucoinSymbol}`));
        res.json(data);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/kucoin/candles', async (req, res) => {
    try {
        const symbol = req.query.symbol || config.activeSymbol;
        const symCfg = symbols[symbol];
        if (!symCfg) return res.status(400).json({ error: `Unknown symbol: ${symbol}` });
        const type = req.query.type || '1hour';
        const limit = req.query.limit || config.api.maxCandles;
        const data = await retryManager.execute(() => fetchJson(`${config.api.kucoinBase}/market/candles?symbol=${symCfg.kucoinSymbol}&type=${type}&limit=${limit}`));
        res.json(data);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/coingecko/price', async (req, res) => {
    try {
        const symbol = req.query.symbol || config.activeSymbol;
        const symCfg = symbols[symbol];
        if (!symCfg) return res.status(400).json({ error: `Unknown symbol: ${symbol}` });
        const data = await retryManager.execute(() => fetchJson(
            `${config.api.coingeckoBase}/simple/price?ids=${symCfg.coingeckoId}&vs_currencies=usd&include_24hr_vol=true&include_24hr_change=true&include_market_cap=true`,
            { 'User-Agent': 'Mozilla/5.0' }
        ));
        res.json(data);
    } catch (e) { res.status(500).json({ error: e.message }); }
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
                try { resolve(JSON.parse(data)); }
                catch (e) { reject(new Error('JSON parse error from ' + url + ': ' + data.substring(0, 300))); }
            });
        });
        req.on('error', reject);
        req.setTimeout(config.api.timeout, () => { req.destroy(); reject(new Error('Request timeout: ' + url)); });
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
    console.log(`  ZBCNUSDT / PROSUSDT Sinyal Dashboard`);
    console.log(`  http://localhost:${PORT}`);
    console.log(`=============================================`);
    console.log(`  Aktif Semboller: ${activeSymbols.join(', ')}`);
    console.log(`  Sunucu: ${config.server.host}:${PORT}`);
    console.log(`  Önbellek: aktif`);
    console.log(`  Retry: ${config.retry.maxRetries} deneme, ${config.retry.initialDelay}ms başlangıç`);
    for (const sym of activeSymbols) {
        console.log(`  ${sym}: ${(signalHistories[sym] || []).length} kayıt`);
    }
    console.log(`  Yenileme: ${config.refresh.dashboardMs / 1000}s`);
    console.log(`  API timeout: ${config.api.timeout / 1000}s`);
    console.log(`=============================================`);
});

app.use((err, req, res, next) => {
    console.error('API Hatası:', err.message);
    res.status(500).json({ error: err.message, code: 'API_ERROR' });
});