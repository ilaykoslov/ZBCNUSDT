// =====================================================
// WebSocket / Gerçek Zamanlı Veri API (KuCoin)
// =====================================================
// Düşük gecikmeli canlı ticker + kline akışı.
//
// KuCoin WebSocket akışı 3 adımdan oluşur:
//   1) POST /api/v1/bullet-public ile geçici token + endpoint al
//   2) wss://<endpoint>?token=...&connectId=... adresine bağlan
//   3) pingInterval süresinde bir { type:'ping' } gönder (yoksa sunucu düşürür)
//
// Önceki sürümdeki hatalar düzeltildi:
//   - Statik `wss://ws-api.kucoin.com/` (token'sız) → bağlanmıyordu.
//   - Heartbeat (ping) yoktu → ~60s sonra koparılıyordu.
//   - bid/ask ters atanmıştı.
//   - error + close olayları çift reconnect tetikliyordu.
// =====================================================

const WebSocket = require('ws');
const https = require('https');

class RealTimeData {
    constructor(config = {}) {
        this.config = config;
        this.ws = null;
        this.subscribed = false;
        this.data = {
            ticker: null,
            orderbook: null,
            candles: {}
        };
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = config.maxReconnectAttempts || 10;
        this.pingTimer = null;
        this.connecting = false;
        this.closedByUser = false;
        // Dinlenecek mum zaman dilimleri
        this.klineTypes = config.klineTypes || ['1min', '5min', '15min', '1hour', '4hour'];
        // Canlı ticker callback'i (motor tarafından ayarlanır)
        this.onTicker = typeof config.onTicker === 'function' ? config.onTicker : null;
        this.onCandle = typeof config.onCandle === 'function' ? config.onCandle : null;
    }

    activeKucoinSymbol() {
        const activeSymbol = (this.config && this.config.activeSymbol) ? this.config.activeSymbol : 'ZBCNUSDT';
        const symbols = (this.config && this.config.symbols) ? this.config.symbols : {};
        const symCfg = symbols[activeSymbol];
        return (symCfg && symCfg.kucoinSymbol) ? symCfg.kucoinSymbol : 'ZBCN-USDT';
    }

    // KuCoin bullet-public token + endpoint al
    fetchBulletToken() {
        return new Promise((resolve, reject) => {
            const req = https.request({
                hostname: 'api.kucoin.com',
                path: '/api/v1/bullet-public',
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Content-Length': 0 }
            }, (res) => {
                let body = '';
                res.on('data', c => body += c);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(body);
                        if (json.code !== '200000' || !json.data || !json.data.token) {
                            return reject(new Error('bullet-public geçersiz yanıt: ' + body.substring(0, 150)));
                        }
                        const server = (json.data.instanceServers || [])[0];
                        if (!server || !server.endpoint) return reject(new Error('instanceServers yok'));
                        resolve({
                            token: json.data.token,
                            endpoint: server.endpoint,
                            pingInterval: server.pingInterval || 18000
                        });
                    } catch (e) {
                        reject(new Error('bullet-public JSON parse hatası: ' + e.message));
                    }
                });
            });
            req.on('error', reject);
            req.setTimeout(10000, () => { req.destroy(); reject(new Error('bullet-public timeout')); });
            req.end();
        });
    }

    // WebSocket bağlantısı kur (token akışıyla)
    async connect() {
        if (this.connecting) return;
        this.connecting = true;
        this.closedByUser = false;
        try {
            const { token, endpoint, pingInterval } = await this.fetchBulletToken();
            const connectId = `zbcn_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
            const wsUrl = `${endpoint}?token=${encodeURIComponent(token)}&connectId=${connectId}`;

            this.ws = new WebSocket(wsUrl);
            this.pingIntervalMs = pingInterval;

            this.ws.on('open', () => {
                console.log('[WS] KuCoin bağlantısı kuruldu');
                this.reconnectAttempts = 0;
                this.connecting = false;
                this.startHeartbeat();
                this.subscribe();
            });

            this.ws.on('message', (raw) => this.handleMessage(raw));

            this.ws.on('error', (error) => {
                console.error('[WS] hata:', error.message);
                // reconnect 'close' olayında tetiklenecek (çift reconnect önlenir)
            });

            this.ws.on('close', () => {
                console.log('[WS] bağlantı kapandı');
                this.stopHeartbeat();
                this.connecting = false;
                this.subscribed = false;
                if (!this.closedByUser) this.scheduleReconnect();
            });
        } catch (e) {
            console.error('[WS] bağlantı kurulamadı:', e.message);
            this.connecting = false;
            if (!this.closedByUser) this.scheduleReconnect();
        }
    }

    startHeartbeat() {
        this.stopHeartbeat();
        const interval = this.pingIntervalMs || 18000;
        this.pingTimer = setInterval(() => {
            // KuCoin uygulama seviyesi ping mesajı bekler
            this.send({ id: Date.now().toString(), type: 'ping' });
        }, interval);
        if (this.pingTimer.unref) this.pingTimer.unref();
    }

    stopHeartbeat() {
        if (this.pingTimer) { clearInterval(this.pingTimer); this.pingTimer = null; }
    }

    // Abonelik mesajları gönder
    subscribe() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        const kucoinSym = this.activeKucoinSymbol();

        // Ticker (canlı fiyat + bestBid/bestAsk)
        this.send({
            id: Date.now().toString(),
            type: 'subscribe',
            topic: `/market/ticker:${kucoinSym}`,
            privateChannel: false,
            response: true
        });

        // Kline abonelikleri
        this.klineTypes.forEach(tf => {
            this.send({
                id: (Date.now() + Math.random()).toString(),
                type: 'subscribe',
                topic: `/market/candles:${kucoinSym}_${tf}`,
                privateChannel: false,
                response: true
            });
        });

        this.subscribed = true;
    }

    // Mesaj gönder
    send(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            try { this.ws.send(JSON.stringify(message)); } catch (e) { /* ignore */ }
        }
    }

    // Gelen mesajı işle
    handleMessage(raw) {
        try {
            const message = JSON.parse(raw);
            switch (message.type) {
                case 'welcome':
                case 'ack':
                case 'pong':
                    break;
                case 'message':
                    this.processMessage(message);
                    break;
                case 'error':
                    console.error('[WS] sunucu hatası:', message.data || message);
                    break;
            }
        } catch (e) {
            console.error('[WS] mesaj işleme hatası:', e.message);
        }
    }

    // Mesaj içeriğini işle
    processMessage(message) {
        const { topic, data } = message;
        if (!topic || !data) return;

        if (topic.includes('/market/ticker')) {
            // KuCoin ticker: { bestAsk, bestBid, price, size, time, ... }
            const bid = parseFloat(data.bestBid);
            const ask = parseFloat(data.bestAsk);
            this.data.ticker = {
                price: parseFloat(data.price),
                size: parseFloat(data.size),
                bestBid: bid,
                bestAsk: ask,
                timestamp: data.time || Date.now()
            };
            // FIX: bid bestBid'den, ask bestAsk'tan (önceden ters atanmıştı)
            this.data.orderbook = {
                bid: Number.isFinite(bid) ? bid : 0,
                ask: Number.isFinite(ask) ? ask : 0,
                spread: 0,
                timestamp: data.time || Date.now()
            };
            if (this.data.orderbook.bid > 0 && this.data.orderbook.ask > 0) {
                this.data.orderbook.spread =
                    ((this.data.orderbook.ask - this.data.orderbook.bid) / this.data.orderbook.ask) * 100;
            }
            if (this.onTicker) {
                try { this.onTicker(this.data.ticker); } catch (e) { /* ignore */ }
            }
        } else if (topic.includes('/market/candles')) {
            // topic: /market/candles:ZBCN-USDT_1hour ; data.candles = [time,open,close,high,low,vol,turnover]
            const tf = topic.split('_')[1] || '1min';
            const c = data.candles;
            if (Array.isArray(c)) {
                const candle = {
                    time: parseInt(c[0]) * 1000,
                    open: parseFloat(c[1]),
                    close: parseFloat(c[2]),
                    high: parseFloat(c[3]),
                    low: parseFloat(c[4]),
                    volume: parseFloat(c[5])
                };
                this.data.candles[tf] = candle;
                if (this.onCandle) {
                    try { this.onCandle(tf, candle); } catch (e) { /* ignore */ }
                }
            }
        }
    }

    // Yeniden bağlanma (exponential backoff)
    scheduleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('[WS] Maksimum yeniden bağlanma sayısı aşıldı');
            return;
        }
        this.reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
        console.log(`[WS] Yeniden bağlanma ${this.reconnectAttempts}/${this.maxReconnectAttempts} (${delay}ms)`);
        const t = setTimeout(() => this.connect(), delay);
        if (t.unref) t.unref();
    }

    getData() {
        return this.data;
    }

    isConnected() {
        return !!this.ws && this.ws.readyState === WebSocket.OPEN;
    }

    close() {
        this.closedByUser = true;
        this.stopHeartbeat();
        if (this.ws) {
            try { this.ws.close(); } catch (e) { /* ignore */ }
        }
    }
}

module.exports = RealTimeData;
