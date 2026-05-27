# ZBCNUSDT - Mimari Dokümantasyonu

## 🏗️ Genel Mimari

ZBCNUSDT, **two-tier architecture** (iki katmanlı mimari) kullanır:

```
┌─────────────────────────────────────────────────────────────┐
│                     CLIENT (dashboard.html)                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  UI Layer (HTML/CSS/JS)                                │ │
│  │  - 10+ İndikatör Paneli                                │ │
│  │  - Sinyal Göstergeleri                                 │ │
│  │  - Multi-Timeframe Analizi                             │ │
│  │  - Sinyal Geçmişi                                      │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Analysis Layer (Client-Side JS)                       │ │
│  │  - calculateRSI, calculateMACD, calculateADX           │ │
│  │  - analyzeTimeframe, detectDivergence                  │ │
│  │  - runAnalysis, fetchAllData                           │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTP/REST API
                            │
┌─────────────────────────────────────────────────────────────┐
│                     SERVER (server.js)                       │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Express.js Proxy Server                               │ │
│  │  - /api/all (merkezi veri toplama)                     │ │
│  │  - /api/kucoin/* (KuCoin proxy)                        │ │
│  │  - /api/coingecko/* (CoinGecko proxy)                  │ │
│  │  - /api/signal-history (sinyal loglama)                │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Data Cache Layer                                      │ │
│  │  - dataCache (bellek içi)                              │ │
│  │  - signals.json (kalıcı)                               │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## 📁 Modüler Yapı

```
ZBCNUSDT/
├── server.js              # Express proxy sunucu
├── config.js              # Merkezi yapılandırma
├── dashboard.html         # Client-side dashboard (1630+ satır)
├── package.json           # npm bağımlılıkları
├── .env.example           # Environment şablonu
├── README.md              # Kullanım dokümantasyonu
├── docs/
│   ├── ARCHITECTURE.md    # Bu dosya
│   └── INDICATORS.md      # İndikatör dokümantasyonu
├── core/
│   ├── index.js           # Core modüller
│   ├── indicators/        # Teknik indikatörler
│   │   ├── index.js
│   │   ├── ichimoku.js    # Ichimoku Cloud
│   │   ├── williamsR.js   # Williams %R
│   │   ├── cci.js         # CCI
│   │   ├── vwap.js        # VWAP
│   │   └── volumeProfile.js
│   ├── signals/           # Sinyal üretimi
│   │   ├── index.js
│   │   └── confluence.js  # Multi-TF confluence
│   └── backtest/          # Backtest modülü
│       └── index.js
├── api/
│   ├── index.js
│   └── realtime.js        # WebSocket entegrasyonu
├── utils/
│   ├── index.js
│   └── webhook.js         # Telegram/Discord webhook
├── data/
│   └── signals.json       # Sinyal geçmişi
└── test_signal.*          # Test dosyaları
```

## 🔌 API Endpoints

### Proxy Endpoints

| Endpoint | Metod | Açıklama |
|----------|-------|----------|
| `/api/all` | GET | Tüm veriler (ticker, orderbook, mumlar, CoinGecko) |
| `/api/kucoin/ticker` | GET | KuCoin ticker verisi |
| `/api/kucoin/candles` | GET | KuCoin mum verileri |
| `/api/coingecko/price` | GET | CoinGecko fiyat verisi |

### Data Endpoints

| Endpoint | Metod | Açıklama |
|----------|-------|----------|
| `/api/health` | GET | Sunucu sağlık kontrolü |
| `/api/config` | GET | Yapılandırma ayarları |
| `/api/signal-history` | GET | Sinyal geçmişi |
| `/api/log-signal` | POST | Sinyal kaydet |
| `/api/signal-stats` | GET | Sinyal istatistikleri |

## 📊 Sinyal Üretimi Akışı

```
1. Veri Çekme (server.js)
   ├─ KuCoin Ticker → price, change, volume
   ├─ KuCoin Orderbook → bid/ask, spread
   ├─ KuCoin Candles (1h, 15m, 4h) → OHLCV
   └─ CoinGecko → market cap, volume

2. Veri Önbellekleme
   ├─ dataCache (bellek içi, 60s geçerlilik)
   └─ signals.json (kalıcı, data/)

3. Client-Side Analiz (dashboard.html)
   ├─ parseKuCoinCandles() → Format dönüşümü
   ├─ calculateRSI(), calculateMACD(), ...
   ├─ analyzeTimeframe() → Her TF için analiz
   └─ runAnalysis() → Multi-TF confluence

4. Sinyal Üretimi
   ├─ Trend Score (30%)
   ├─ Momentum Score (25%)
   ├─ Volatility Score (15%)
   ├─ Volume Score (15%)
   └─ Structure Score (15%)

5. Confluence
   ├─ 1h: 50% weight
   ├─ 15m: 20% weight
   └─ 4h: 30% weight

6. Final Signal
   ├─ BUY (score >= 12)
   ├─ SELL (score <= -12)
   └─ NEUTRAL (arada)

7. Loglama
   └─ /api/log-signal → signals.json
```

## 🎯 İndikatör Kategorileri

### Trend İndikatörleri
- **SMA (7, 25, 99)** - Basit hareketli ortalamalar
- **EMA (12, 26, 9)** - Üstel hareketli ortalamalar
- **ADX (14)** - Trend gücü

### Momentum İndikatörleri
- **RSI (14)** - Göreceli güç endeksi
- **Stochastic RSI** - Stokastik RSI
- **MACD (12, 26, 9)** - Konverjans/divergans

### Volatilite İndikatörleri
- **Bollinger Bands (20, 2)** - Bantlar
- **ATR (14)** - Ortalama gerçek aralık

### Hacim İndikatörleri
- **OBV** - On-balance volume

### Gelişmiş İndikatörler
- **Divergence Detection** - Uzlaşmazlık
- **Support/Resistance** - Destek/direnç
- **Pivot Levels** - Pivot seviyeleri

### Yeni İndikatörler (v2.2.0)
- **Ichimoku Cloud** - Gökkuşağı grafik
- **Williams %R** - Aşırı alım/satım
- **CCI** - Commodity channel index
- **VWAP** - Hacim ağırlıklı ortalama fiyat
- **Volume Profile** - Hacim profili

## 🔒 Güvenlik

### Rate Limiting
- 100 istek/dakika (API endpoint'leri için)
- express-rate-limit middleware

### CORS
- Environment variable'dan yapılandırılabilir
- Varsayılan: `*` (tüm originler)

### Error Handling
- Merkezi error middleware
- API hataları loglanır
- Kullanıcıya anlamlı hata mesajları

## 📈 Performans

### Önbellekleme
- **dataCache**: Bellek içi, 60s geçerlilik
- **signals.json**: Kalıcı, JSON dosyası

### Async/Await
- Tüm API çağrıları async
- Promise.all() ile paralel istekler

### Memory Management
- Sinyal geçmişi: 500 kayıt maksimum
- Eski kayıtlar otomatik silinir

## 🔄 WebSocket Entegrasyonu (v2.2.0)

```
KuCoin WebSocket (wss://ws-api.kucoin.com/)
├─ /market/ticker:ZBCN-USDT
├─ /market/orderbook:1:ZBCN-USDT
└─ /market/candles:ZBCN-USDT_{tf}
```

### Özellikler
- Gerçek zamanlı fiyat güncellemeleri
- Orderbook güncellemeleri
- Kline güncellemeleri
- Otomatik yeniden bağlanma
- Heartbeat (ping/pong)

## 🧪 Backtest Modülü (v2.2.0)

### Stratejiler
- **RSI Strategy**: Overbought/oversold
- **SMA Crossover**: 7/25 period
- **MACD Strategy**: Signal line cross

### Metrikler
- Win rate (%)
- Profit factor
- Max drawdown (%)
- Total return (%)
- Trades count

## 📱 Dashboard Özellikleri

### UI Components
- **Price Hero**: Anlık fiyat, 24s istatistikleri
- **Signal Card**: BUY/SELL/NEUTRAL badge
- **Indicator Panels**: 10+ indikatör
- **Multi-TF Status**: 15m/1h/4h sinyalleri
- **Signal History**: Geçmiş sinyaller
- **Mini Chart**: 48 mum sparkline

### Auto-Refresh
- 15 saniyelik periyodik güncelleme
- Visibility change desteği
- Error retry mekanizması

## 📝 Lisans

MIT License - SERDOBABA