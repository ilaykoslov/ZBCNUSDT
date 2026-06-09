// =====================================================
// Canlı Sinyal Üretim Motoru (Live Signal Generation Engine)
// =====================================================
// Sürekli çalışan (daemon) sinyal motoru. GERÇEK veriyle çalışır:
//   - REST: KuCoin mum (candle) verisi periyodik çekilir → multi-TF
//     confluence sinyali `computeSignal` ile yeniden hesaplanır.
//   - WebSocket: KuCoin canlı ticker (düşük gecikme) → anlık fiyat akışı.
//
// Sinyal veya state değiştiğinde:
//   - konsola loglar
//   - kalıcı geçmişe yazar (db: data/signals_*.json) — `onSignalChange`
//   - webhook (Telegram/Discord) tetikler — `onSignalChange`
//   - dashboard WS istemcilerine yayınlar — `onSignalChange` / `onTicker`
//
// Dayanıklılık: her döngü try/catch ile sarılı; bir sembolün hatası
// diğerlerini ve motoru etkilemez. WS kopması otomatik reconnect ile toparlanır.
// =====================================================

const RealTimeData = require('../../api/realtime');

class LiveSignalEngine {
    /**
     * @param {Object} opts
     * @param {Object} opts.config        - uygulama config'i (config.js)
     * @param {string[]} opts.symbols     - işlenecek sembol anahtarları
     * @param {Function} opts.computeSignal - (args) => payload
     * @param {Function} opts.fetchCandles  - async (kucoinSym, type, limit) => candle[]  (parse edilmiş)
     * @param {Function} [opts.onSignal]       - (symbol, payload) => void  (her hesaplamada)
     * @param {Function} [opts.onSignalChange] - (symbol, payload, prev) => void  (yalnızca değişimde)
     * @param {Function} [opts.onTicker]       - (symbol, ticker) => void  (canlı fiyat)
     * @param {number} [opts.pollIntervalMs]
     * @param {boolean} [opts.enableWebSocket]
     */
    constructor(opts = {}) {
        this.config = opts.config || {};
        this.symbols = Array.isArray(opts.symbols) && opts.symbols.length
            ? opts.symbols
            : Object.keys(this.config.symbols || {});
        this.computeSignal = opts.computeSignal;
        this.fetchCandles = opts.fetchCandles;
        this.onSignal = typeof opts.onSignal === 'function' ? opts.onSignal : () => {};
        this.onSignalChange = typeof opts.onSignalChange === 'function' ? opts.onSignalChange : () => {};
        this.onTicker = typeof opts.onTicker === 'function' ? opts.onTicker : () => {};

        this.pollIntervalMs = Math.max(3000, opts.pollIntervalMs || 15000);
        this.enableWebSocket = opts.enableWebSocket !== false;

        // Çalışma durumu
        this.timers = new Map();        // symbol -> interval timer
        this.latest = new Map();        // symbol -> son payload
        this.lastKey = new Map();       // symbol -> "signal|state" (değişim tespiti)
        this.livePrice = new Map();     // symbol -> son canlı fiyat
        this.stats = {
            startedAt: null,
            ticks: 0,
            errors: 0,
            signalChanges: 0,
            lastTickAt: null,
            lastError: null
        };
        this.rt = null;
        this.running = false;
    }

    start() {
        if (this.running) return;
        if (typeof this.computeSignal !== 'function' || typeof this.fetchCandles !== 'function') {
            throw new Error('LiveSignalEngine: computeSignal ve fetchCandles zorunlu');
        }
        this.running = true;
        this.stats.startedAt = Date.now();

        console.log(`[ENGINE] Canlı sinyal motoru başlatıldı — semboller: ${this.symbols.join(', ')} | poll: ${this.pollIntervalMs}ms`);

        // İlk hesaplamayı hemen yap, sonra periyodik
        for (const symbol of this.symbols) {
            this.tick(symbol);
            const t = setInterval(() => this.tick(symbol), this.pollIntervalMs);
            if (t.unref) t.unref();
            this.timers.set(symbol, t);
        }

        if (this.enableWebSocket) this.startWebSocket();
    }

    startWebSocket() {
        try {
            const activeSymbol = this.config.activeSymbol || this.symbols[0];
            this.rt = new RealTimeData({
                ...this.config,
                activeSymbol,
                klineTypes: ['1min'],
                onTicker: (ticker) => {
                    if (!ticker || !Number.isFinite(ticker.price)) return;
                    this.livePrice.set(activeSymbol, ticker.price);
                    this.stats.lastTickerAt = Date.now();
                    try { this.onTicker(activeSymbol, ticker); } catch (e) { /* ignore */ }
                }
            });
            this.rt.connect();
        } catch (e) {
            console.error('[ENGINE] WebSocket başlatılamadı:', e.message);
        }
    }

    async tick(symbol) {
        const symCfg = (this.config.symbols || {})[symbol];
        if (!symCfg) return;
        const kucoinSym = symCfg.kucoinSymbol;
        try {
            const limit = (this.config.api && this.config.api.maxCandles) || 100;
            const [c1h, c15m, c4h] = await Promise.all([
                this.fetchCandles(kucoinSym, '1hour', limit),
                this.fetchCandles(kucoinSym, '15min', limit),
                this.fetchCandles(kucoinSym, '4hour', limit)
            ]);

            if (!c1h || c1h.length < 30) throw new Error('yetersiz 1h mum');

            const candlesByTf = { '1h': c1h, '15m': c15m, '4h': c4h };
            const payload = this.computeSignal({ symbol, candlesByTf, appConfig: this.config });

            // Canlı WS fiyatı varsa payload'a ekle (düşük gecikme)
            const live = this.livePrice.get(symbol);
            if (Number.isFinite(live)) payload.livePrice = live;

            this.latest.set(symbol, payload);
            this.stats.ticks++;
            this.stats.lastTickAt = Date.now();

            try { this.onSignal(symbol, payload); } catch (e) { /* ignore */ }

            // Değişim tespiti: signal veya state değişti mi?
            const key = `${payload.signal}|${payload.state}`;
            const prevKey = this.lastKey.get(symbol);
            if (prevKey !== key) {
                this.lastKey.set(symbol, key);
                // İlk hesaplamada (prevKey undefined) da bir kez yayınla
                this.stats.signalChanges++;
                console.log(`[ENGINE] ${symbol} → ${payload.signal} (state=${payload.state}, score=${payload.weightedScore}, conf=${payload.confidence}%, grade=${payload.grade})`);
                try { this.onSignalChange(symbol, payload, prevKey || null); } catch (e) { console.error('[ENGINE] onSignalChange hatası:', e.message); }
            }
        } catch (e) {
            this.stats.errors++;
            this.stats.lastError = `${symbol}: ${e.message}`;
            console.error(`[ENGINE] ${symbol} tick hatası:`, e.message);
        }
    }

    getLatest(symbol) {
        return this.latest.get(symbol) || null;
    }

    getStatus() {
        return {
            running: this.running,
            symbols: this.symbols,
            pollIntervalMs: this.pollIntervalMs,
            webSocket: this.enableWebSocket ? (this.rt && this.rt.isConnected() ? 'connected' : 'disconnected') : 'disabled',
            stats: { ...this.stats },
            livePrices: Object.fromEntries(this.livePrice),
            latest: Object.fromEntries(
                Array.from(this.latest.entries()).map(([s, p]) => [s, {
                    signal: p.signal, state: p.state, confidence: p.confidence,
                    weightedScore: p.weightedScore, grade: p.grade, regime: p.regime,
                    timestamp: p.timestamp
                }])
            )
        };
    }

    stop() {
        this.running = false;
        for (const t of this.timers.values()) clearInterval(t);
        this.timers.clear();
        if (this.rt) { try { this.rt.close(); } catch (e) { /* ignore */ } this.rt = null; }
        console.log('[ENGINE] Canlı sinyal motoru durduruldu');
    }
}

module.exports = LiveSignalEngine;
