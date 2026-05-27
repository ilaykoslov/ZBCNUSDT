// =====================================================
// WebSocket / Gerçek Zamanlı Veri API
// =====================================================
// KuCoin WebSocket entegrasyonu
// =====================================================

const WebSocket = require('ws');

class RealTimeData {
    constructor(config) {
        this.config = config;
        this.ws = null;
        this.subscribed = false;
        this.data = {
            ticker: null,
            orderbook: null,
            candles: {}
        };
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
    }

    // WebSocket bağlantısı kur
    connect() {
        const wsUrl = 'wss://ws-api.kucoin.com/'; // KuCoin WebSocket endpoint

        this.ws = new WebSocket(wsUrl);

        this.ws.on('open', () => {
            console.log('WebSocket bağlantısı kuruldu');
            this.reconnectAttempts = 0;
            this.subscribe();
        });

        this.ws.on('message', (data) => {
            this.handleMessage(data);
        });

        this.ws.on('error', (error) => {
            console.error('WebSocket hatası:', error.message);
            this.reconnect();
        });

        this.ws.on('close', () => {
            console.log('WebSocket bağlantısı kapatıldı');
            this.reconnect();
        });
    }

    // Abonelik mesajları gönder
    subscribe() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        const activeSymbol = (this.config && this.config.activeSymbol) ? this.config.activeSymbol : 'ZBCNUSDT';
        const symbols = (this.config && this.config.symbols) ? this.config.symbols : {};
        const symCfg = symbols[activeSymbol];
        const kucoinSym = symCfg?.kucoinSymbol || 'ZBCN-USDT';

        // Ticker aboneliği
        this.send({
            type: 'subscribe',
            topic: `/market/ticker:${kucoinSym}`,
            privateChannel: false,
            response: true
        });

        // Orderbook aboneliği (seviye 1)
        this.send({
            type: 'subscribe',
            topic: `/market/orderbook:1:${kucoinSym}`,
            privateChannel: false,
            response: true
        });

        // Kline abonelikleri
        ['1min', '5min', '15min', '1hour', '4hour'].forEach(tf => {
            this.send({
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
            this.ws.send(JSON.stringify(message));
        }
    }

    // Mesaj işle
    handleMessage(data) {
        try {
            const message = JSON.parse(data);

            switch (message.type) {
                case 'welcome':
                    console.log('WebSocket hoş geldiniz mesajı');
                    break;

                case 'message':
                    this.processMessage(message);
                    break;

                case 'pong':
                    // Heartbeat cevabı
                    break;
            }
        } catch (e) {
            console.error('Mesaj işleme hatası:', e.message);
        }
    }

    // Mesaj içeriğini işle
    processMessage(message) {
        const { topic, data } = message;

        if (topic.includes('/market/ticker')) {
            this.data.ticker = {
                price: parseFloat(data.price),
                change: parseFloat(data.changeRate) * 100,
                volume: parseFloat(data.vol),
                high: parseFloat(data.high),
                low: parseFloat(data.low),
                timestamp: data.timestamp
            };
        } else if (topic.includes('/market/orderbook')) {
            this.data.orderbook = {
                bid: parseFloat(data.asks[0]?.price || 0),
                ask: parseFloat(data.bids[0]?.price || 0),
                spread: 0,
                timestamp: data.timestamp
            };
            if (this.data.orderbook.bid > 0 && this.data.orderbook.ask > 0) {
                this.data.orderbook.spread = ((this.data.orderbook.ask - this.data.orderbook.bid) / this.data.orderbook.ask) * 100;
            }
        } else if (topic.includes('/market/candles')) {
            const tf = topic.split('_')[1] || '1min';
            this.data.candles[tf] = {
                time: data.time,
                open: parseFloat(data.data.open),
                high: parseFloat(data.data.high),
                low: parseFloat(data.data.low),
                close: parseFloat(data.data.close),
                volume: parseFloat(data.data.vol)
            };
        }
    }

    // Yeniden bağlanma
    reconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
            console.log(`Yeniden bağlanma denemesi ${this.reconnectAttempts}/${this.maxReconnectAttempts} (${delay}ms)`);
            setTimeout(() => this.connect(), delay);
        } else {
            console.error('Maksimum yeniden bağlanma sayısı aşıldı');
        }
    }

    // Veri al
    getData() {
        return this.data;
    }

    // Bağlantı durumu
    isConnected() {
        return this.ws && this.ws.readyState === WebSocket.OPEN;
    }

    // Bağlantıyı kapat
    close() {
        if (this.ws) {
            this.ws.close();
        }
    }
}

module.exports = RealTimeData;