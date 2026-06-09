const express = require('express');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const config = require('./config');
const { PaperTradingEngine, RiskManager, DataValidator } = require('./core');
const { retryManager } = require('./utils/retry');
const { sendTelegramMessage, sendDiscordMessage } = require('./utils/webhook');
const { WebSocketServer } = require('ws');
const { RealTimeData } = require('./api');
const LiveSignalEngine = require('./core/engine/liveSignalEngine');


const app = express();
const PORT = (() => { const p = parseInt(process.env.PORT); return !isNaN(p) && p > 0 ? p : config.server.port; })();
// H-3 FIX: parseInt NaN validation — geçersiz env vars default'a düşer
if (process.env.API_TIMEOUT) { const p = parseInt(process.env.API_TIMEOUT); if (!isNaN(p) && p > 0) config.api.timeout = p; }
if (process.env.REFRESH_MS) { const p = parseInt(process.env.REFRESH_MS); if (!isNaN(p) && p > 0) config.refresh.dashboardMs = p; }

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

    if (!config.alerts.enabled) {
        // Live dashboard push: alerts kapalı olsa bile signal görünümü gelsin
        try {
            broadcast(symbol, { type: 'signalChange', symbol, signal: {
                signal: signalEntry.signal,
                confidence: signalEntry.confidence,
                weightedScore: signalEntry.weightedScore,
                tfAlignment: signalEntry.tfAlignment,
                regime: signalEntry.regime,
                grade: signalEntry.grade
            }, ts: Date.now() });
        } catch (e) {
            // ignore
        }
        return;
    }


    // Dashboard'a canlı push (anlık sinyal görünümü)
    try {
        broadcast(symbol, {
            type: 'signalChange',
            symbol,
            signal: {
                signal: signalEntry.signal,
                confidence: signalEntry.confidence,
                weightedScore: signalEntry.weightedScore,
                tfAlignment: signalEntry.tfAlignment,
                regime: signalEntry.regime,
                grade: signalEntry.grade
            },
            ts: Date.now()
        });
    } catch (e) {
        // ignore
    }



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

// M-1 FIX: Async yazma + race condition önleme (C-7)
const signalWriteQueues = {};
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
    // Async queue ile race condition önle
    if (!signalWriteQueues[symbol]) signalWriteQueues[symbol] = Promise.resolve();
    signalWriteQueues[symbol] = signalWriteQueues[symbol].then(async () => {
        try {
            if (!fs.existsSync(SIGNAL_HISTORY_DIR)) fs.mkdirSync(SIGNAL_HISTORY_DIR, { recursive: true });
            await fs.promises.writeFile(
                path.join(SIGNAL_HISTORY_DIR, `signals_${symbol}.json`),
                JSON.stringify(signalHistories[symbol], null, 2)
            );
            // Sinyal kaydedildiğinde alarm tetikle (async, bekleme)
            setImmediate(() => triggerAlerts(symbol, signalEntry).catch(e => console.error(e)));
        } catch (e) {
            console.error(`${symbol} sinyal kaydı yazılamadı:`, e.message);
        }
    }).catch(e => console.error(`${symbol} queue hatası:`, e.message));
}

// ========================================
// EXPRESS KURULUMU
// ========================================

app.use(express.json());

// ========================================
// LIVE PUSH (WebSocket) - Dashboard anlık güncelleme
// ========================================
const wss = new WebSocketServer({ noServer: true, path: '/ws' });
const wsClientsBySymbol = new Map(); // symbol -> Set(ws)

function getClientSet(symbol) {
    if (!wsClientsBySymbol.has(symbol)) wsClientsBySymbol.set(symbol, new Set());
    return wsClientsBySymbol.get(symbol);
}

function broadcast(symbol, payload) {
    const set = wsClientsBySymbol.get(symbol);
    if (!set || set.size === 0) return;
    const msg = JSON.stringify(payload);
    for (const ws of set) {
        if (ws.readyState === ws.OPEN) ws.send(msg);
    }
}

function normalizeSymbol(sym) {
    return sym && symbols[sym] ? sym : config.activeSymbol;
}

wss.on('connection', (ws) => {
    // Default subscription
    let subscribedSymbol = config.activeSymbol;

    ws.on('message', (raw) => {
        try {
            const msg = JSON.parse(raw.toString());
            if (msg && msg.type === 'subscribe' && msg.symbol) {
                subscribedSymbol = normalizeSymbol(msg.symbol);
                const set = getClientSet(subscribedSymbol);
                set.add(ws);
            }
        } catch (e) {
            // ignore
        }
    });

    ws.on('close', () => {
        for (const [sym, set] of wsClientsBySymbol.entries()) {
            if (set.has(ws)) set.delete(ws);
        }
    });

    getClientSet(subscribedSymbol).add(ws);
    ws.send(JSON.stringify({ type: 'welcome', symbol: subscribedSymbol, ts: Date.now() }));
});

// Create real HTTP server so ws upgrade can work reliably
const httpServer = http.createServer(app);

// Upgrade handler for WebSocket
httpServer.on('upgrade', (request, socket, head) => {
    const pathname = request.url ? request.url.split('?')[0] : '';
    if (pathname !== '/ws') return socket.destroy();

    wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
    });
});



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
// M-18 FIX: API endpoint'lerinde önbelleklemeyi engelle
// ========================================
app.use('/api/', (req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    next();
});

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

// ========================================
// SİNYAL ENDPOINT - BACKEND SOURCE OF TRUTH
// ========================================
const { computeSignal } = require('./core/signals/signalEngine');

function parseKuCoinCandlesToBackend(data) {
    // KuCoin format: [time, open, close, high, low, volume, turnover]
    if (!Array.isArray(data)) return null;
    return [...data].reverse().map(c => ({
        time: parseInt(c[0]) * 1000,
        open: parseFloat(c[1]),
        close: parseFloat(c[2]),
        high: parseFloat(c[3]),
        low: parseFloat(c[4]),
        volume: parseFloat(c[5])
    }));
}

app.get('/api/signal', async (req, res) => {
    try {
        const symbol = req.query.symbol || config.activeSymbol;
        const symCfg = symbols[symbol];
        if (!symCfg) return res.status(400).json({ error: `Unknown symbol: ${symbol}` });

        // Prefer cached candles if recent enough
        const cached = dataCaches[symbol]?.data;
        const cacheOk = cached && cached.candles1h && cached.candles1h.code === '200000';

        const kucoinSym = symCfg.kucoinSymbol;

        const fetchSafe = async (url, headers = {}) => {
            try {
                return await retryManager.execute(async () => {
                    return await fetchJson(url, headers);
                }, { context: `Signal API ${symbol}` });
            } catch (e) {
                console.error(`Signal API hatası [${symbol}]:`, url, e.message.substring(0, 100));
                return { error: e.message, code: 'ERROR' };
            }
        };

        const [candles1h, candles15m, candles4h] = cacheOk
            ? [cached.candles1h, cached.candles15m, cached.candles4h]
            : await Promise.all([
                fetchSafe(`${config.api.kucoinBase}/market/candles?symbol=${kucoinSym}&type=1hour&limit=${config.api.maxCandles}`),
                fetchSafe(`${config.api.kucoinBase}/market/candles?symbol=${kucoinSym}&type=15min&limit=${config.api.maxCandles}`),
                fetchSafe(`${config.api.kucoinBase}/market/candles?symbol=${kucoinSym}&type=4hour&limit=${config.api.maxCandles}`)
            ]);

        if (!candles1h || candles1h.code !== '200000') {
            return res.status(503).json({ error: `Candles unavailable for ${symbol}` });
        }

        const c1h = parseKuCoinCandlesToBackend(candles1h.data);
        const c15m = candles15m && candles15m.code === '200000' ? parseKuCoinCandlesToBackend(candles15m.data) : null;
        const c4h = candles4h && candles4h.code === '200000' ? parseKuCoinCandlesToBackend(candles4h.data) : null;

        if (!c1h || c1h.length < 30) return res.status(503).json({ error: `Insufficient 1h candles for ${symbol}` });
        if (!c15m || c15m.length < 30) return res.status(503).json({ error: `Insufficient 15m candles for ${symbol}` });
        if (!c4h || c4h.length < 30) return res.status(503).json({ error: `Insufficient 4h candles for ${symbol}` });

        // Validate (best-effort)
        try { dataValidator.validateCandleData(c1h, '1h'); } catch (_) {}
        try { dataValidator.validateCandleData(c15m, '15m'); } catch (_) {}
        try { dataValidator.validateCandleData(c4h, '4h'); } catch (_) {}

        const candlesByTf = { '1h': c1h, '15m': c15m, '4h': c4h };

        const payload = computeSignal({
            symbol,
            candlesByTf,
            appConfig: config
        });

        res.json(payload);

    } catch (e) {
        console.error(`/api/signal hatası:`, e.message);
        res.status(500).json({ error: e.message, code: 'ERROR' });
    }
});

// ========================================
// CANLI SİNYAL MOTORU - DURUM
// ========================================
let liveEngine = null;

app.get('/api/engine/status', (req, res) => {
    if (!liveEngine) return res.json({ running: false, message: 'Canlı sinyal motoru devre dışı' });
    res.json(liveEngine.getStatus());
});

app.get('/api/engine/latest', (req, res) => {
    const symbol = req.query.symbol || config.activeSymbol;
    if (!liveEngine) return res.status(503).json({ error: 'Motor devre dışı' });
    const latest = liveEngine.getLatest(symbol);
    if (!latest) return res.status(404).json({ error: `Henüz ${symbol} için sinyal üretilmedi` });
    res.json(latest);
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
            }
            // C-1 FIX: TLS sertifika doğrulaması varsayılan olarak AÇIK bırakıldı (MITM riski).
            // rejectUnauthorized'ı yalnızca açıkça istenirse devre dışı bırak.
        };
        // Sertifika doğrulamasını yalnızca açıkça izin verildiğinde atla.
        if (process.env.ALLOW_INSECURE_TLS === 'true') {
            opts.rejectUnauthorized = false;
        }

        const req = mod.request(opts, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                // C-5 FIX: Boş yanıt kontrolü
                if (!data || !data.trim()) {
                    return reject(new Error('Empty response from ' + url));
                }
                try { resolve(JSON.parse(data)); }
                catch (e) {
                    // H-14 FIX: URL'den API key/secret/token/passphrase temizle
                    const sanitized = url.replace(/[&?](api[_-]?key|secret|token|passphrase)=[^&]+/gi, '$1=***');
                    reject(new Error('JSON parse error from ' + sanitized + ': ' + data.substring(0, 300)));
                }
            });
        });
        req.on('error', reject);
        req.setTimeout(config.api.timeout, () => { req.destroy(); reject(new Error('Request timeout: ' + url)); });
        req.end();
    });
}

// ========================================
// M-4 FIX: Process-level hata yakalama (crash önle)
// ========================================
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection:', reason?.message || reason);
});
process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception:', err.message);
    // Sunucuyu çökertme — toparlanmaya çalış
});

// ========================================
// ANA SAYFA VE BAŞLATMA
// ========================================

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

const server = httpServer.listen(PORT, config.server.host, () => {

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

    startLiveEngine();
});

// ========================================
// CANLI SİNYAL MOTORU - BAŞLATMA
// ========================================
function startLiveEngine() {
    // LIVE_ENGINE_ENABLED=false ile devre dışı bırakılabilir (örn. test ortamı)
    if (process.env.LIVE_ENGINE_ENABLED === 'false') {
        console.log('[ENGINE] Canlı sinyal motoru devre dışı (LIVE_ENGINE_ENABLED=false)');
        return;
    }

    const pollMs = (() => {
        const p = parseInt(process.env.LIVE_ENGINE_POLL_MS);
        return !isNaN(p) && p >= 3000 ? p : 15000;
    })();

    // Motor için mum çekici (gerçek KuCoin REST verisi, retry'li)
    const fetchCandlesForEngine = async (kucoinSym, type, limit) => {
        const url = `${config.api.kucoinBase}/market/candles?symbol=${kucoinSym}&type=${type}&limit=${limit}`;
        const json = await retryManager.execute(() => fetchJson(url), { context: `Engine ${kucoinSym} ${type}` });
        if (!json || json.code !== '200000' || !Array.isArray(json.data)) {
            throw new Error(`mum verisi alınamadı (${type})`);
        }
        return parseKuCoinCandlesToBackend(json.data);
    };

    try {
        liveEngine = new LiveSignalEngine({
            config,
            symbols: activeSymbols,
            computeSignal,
            fetchCandles: fetchCandlesForEngine,
            pollIntervalMs: pollMs,
            enableWebSocket: process.env.LIVE_ENGINE_WS !== 'false',
            // Sinyal/state değişiminde: kalıcı geçmiş (db) + webhook + dashboard push
            onSignalChange: (symbol, payload) => {
                appendSignal(symbol, {
                    signal: payload.signal,
                    confidence: payload.confidence,
                    weightedScore: payload.weightedScore,
                    breakdown: payload.breakdown || {},
                    tfAlignment: payload.tfAlignment || 'unknown',
                    regime: payload.regime || 'Unknown',
                    grade: payload.grade || 'NT',
                    price: payload.livePrice ?? payload.price ?? null,
                    multiTf: payload.multiTf || {},
                    state: payload.state || 'WAIT',
                    source: 'live-engine'
                });
            },
            // Canlı fiyat (düşük gecikme): dashboard WS istemcilerine push
            onTicker: (symbol, ticker) => {
                broadcast(symbol, {
                    type: 'update',
                    symbol,
                    payload: {
                        orderbook: { bestBid: ticker.bestBid, bestAsk: ticker.bestAsk },
                        price: ticker.price
                    },
                    ts: Date.now()
                });
            }
        });
        liveEngine.start();
    } catch (e) {
        console.error('[ENGINE] başlatılamadı:', e.message);
    }
}




app.use((err, req, res, next) => {
    console.error('API Hatası:', err.message);
    res.status(500).json({ error: err.message, code: 'API_ERROR' });
});