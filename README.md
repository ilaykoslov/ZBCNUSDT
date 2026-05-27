# ZBCNUSDT & PROSUSDT Sinyal Terminali

Gerçek zamanlı kripto para sinyal terminali. Multi-timeframe confluence analizi, 15+ teknik indikatör, paper trading simülasyonu ve risk yönetimi.

## 🚀 Hızlı Başlangıç

```bash
# Bağımlılıkları yükle
npm install

# Geliştirme modunda başlat
npm run dev

# Tarayıcıda aç
# http://localhost:3456
```

## 📋 İçindekiler

- [Özellikler](#özellikler)
- [Desteklenen Semboller](#desteklenen-semboller)
- [Kurulum](#kurulum)
- [Kullanım](#kullanım)
- [Test](#test)
- [Mimari](#mimari)
- [API Referansı](#api-referansı)
- [Sinyal Formatı](#sinyal-formatı)
- [Paper Trading](#paper-trading)
- [Güvenlik](#güvenlik)
- [Lisans](#lisans)

## ✨ Özellikler

| Kategori | Özellik |
|----------|---------|
| **📊 Analiz** | 15+ teknik indikatör (RSI, MACD, SMA, BB, ADX, StochRSI, OBV, ATR, Divergence, Ichimoku, Williams %R, CCI, VWAP, Volume Profile) |
| **⏱️ Multi-TF** | 3 zaman dilimi (15dk / 1s / 4s) ağırlıklı confluence |
| **🎯 Sinyal Motoru** | 5 kategorili skorlama (Trend, Momentum, Volatilite, Hacim, Yapı) |
| **🏷️ Trade Grade** | S/A/B/C/NT not sistemi + işlem önerisi |
| **🌡️ Rejim Tespiti** | Trend-Up/Down, Range, Chop otomatik tespiti |
| **⚖️ Dinamik Ağırlık** | Rejime göre kategori ağırlıkları otomatik ayarlanır |
| **🔄 State Machine** | LONG/SHORT/WAIT/NO_TRADE - false signal reduction |
| **💼 Paper Trading** | Sanal portföy, SL/TP, işlem geçmişi, onay sistemi |
| **⚠️ Risk Yönetimi** | Pozisyon boyutlandırma, Kelly Criterion, trailing stop |
| **🔔 Webhook** | Telegram, Discord, Email bildirimleri |
| **📡 WebSocket** | Gerçek zamanlı fiyat akışı (opsiyonel) |
| **📈 Backtest** | RSI/SMA/MACD strateji testleri |

## 🪙 Desteklenen Semboller

| Sembol | KuCoin | CoinGecko | PT Bakiye |
|--------|--------|-----------|-----------|
| **ZBCNUSDT** | ZBCN-USDT | zebec-network | $10,000 |
| **PROSUSDT** | PROS-USDT | pros | $5,000 |

Yeni sembol eklemek için `config.js` → `symbols` bölümünü güncelleyin.

## 📦 Kurulum

### Gereksinimler
- Node.js >= 18.0.0
- npm >= 9.0.0

### Adımlar

```bash
# 1. Projeyi klonla
git clone https://github.com/SERDOBABA/ZBCNUSDT.git
cd ZBCNUSDT

# 2. Bağımlılıkları yükle
npm install

# 3. Ortam değişkenlerini ayarla (opsiyonel)
cp .env.example .env

# 4. Başlat
npm start
```

### Docker ile

```bash
docker-compose up --build
```

## 🎮 Kullanım

### Dashboard
`http://localhost:3456` adresinde tam ekran dashboard:

1. **Sinyal Paneli** - Canlı BUY/SELL/NEUTRAL sinyalleri
2. **İndikatörler** - RSI, MACD, SMA, BB, ADX, StochRSI
3. **Multi-Timeframe** - 15dk/1s/4s uyum analizi
4. **Paper Trading** - Sanal işlemler, portföy takibi
5. **Sinyal Geçmişi** - Son sinyal kayıtları

### Sembol Değiştirme
Dashboard üst kısmındaki dropdown ile ZBCNUSDT ↔ PROSUSDT arasında geçiş yapın.

### Paper Trading
1. Dashboard'un alt kısmındaki **Paper Trading** panelini genişletin
2. İşlem türünü seçin (AL / SAT)
3. "İşlem Yap" butonuna tıklayın veya otomatik sinyal takibi için "🤖 Otomatik İşlem" kullanın
4. Pozisyonları görüntüleyin, SL/TP kontrol edin
5. **Varsayılan: PAPER mod** - gerçek işlem yapılmaz

## 🧪 Test

```bash
# Hızlı test (DOM mock ile client-side indikatörler)
npm test

# Kapsamlı test (ES module, tüm indikatörler)
npm run test:full

# Entegrasyon testi (server çalışıyor olmalı)
npm run test:integration

# Tüm testler
npm run test:all

# Sağlık kontrolü
npm run health
```

### Test Kapsamı
- **Unit test**: İndikatör hesaplamaları, sinyal mantığı
- **Integration test**: API endpoint'leri, paper trading, risk yönetimi
- **Backtest**: RSI/SMA/MACD stratejileri
- **Schema validation**: JSON sinyal formatı doğrulama

## 🏗️ Mimari

```
ZBCNUSDT/
├── server.js              # Express sunucu, proxy, cache, rate limiting
├── config.js              # Merkezi yapılandırma
├── dashboard.html         # Tek dosya dashboard (CSS + HTML + JS)
├── package.json           # Bağımlılıklar ve script'ler
├── .env.example           # Ortam değişkenleri şablonu
├── Dockerfile             # Docker build
├── docker-compose.yml     # Docker compose
├── AGENTS.md              # AI asistan yönergeleri
│
├── core/                  # Ana modüller
│   ├── index.js           # Modül ihracatı
│   ├── paperTrading/      # Paper trading motoru
│   │   └── index.js       #   Portföy, pozisyon, SL/TP
│   ├── risk/              # Risk yönetimi
│   │   └── index.js       #   Pozisyon boyutlandırma, Kelly
│   ├── data/              # Veri doğrulama
│   │   └── index.js       #   Gap detection, interpolasyon
│   ├── backtest/          # Backtest modülü
│   │   └── index.js       #   RSI/SMA/MACD stratejileri
│   ├── signals/           # Sinyal motoru
│   │   ├── index.js       #   Modül ihracatı
│   │   └── confluence.js  #   Confluence, rejim, grading
│   └── indicators/        # Teknik indikatörler
│       ├── index.js       #   Modül ihracatı
│       ├── ichimoku.js    #   Ichimoku Cloud
│       ├── williamsR.js   #   Williams %R
│       ├── cci.js         #   Commodity Channel Index
│       ├── vwap.js        #   Volume Weighted Average Price
│       └── volumeProfile.js # Volume Profile
│
├── api/                   # API modülleri
│   ├── index.js           # Modül ihracatı
│   └── realtime.js        # WebSocket entegrasyonu
│
├── utils/                 # Yardımcı modüller
│   ├── index.js           # Modül ihracatı
│   ├── retry.js           # Retry, backoff, circuit breaker
│   └── webhook.js         # Telegram/Discord/Email bildirimleri
│
├── tests/                 # Test dosyaları
│   ├── integration.test.js # Entegrasyon testleri
│   └── test_schema.json   # JSON sinyal formatı şeması
│
├── docs/                  # Dokümantasyon
│   ├── README.md          # Doküman ana sayfası
│   ├── ARCHITECTURE.md    # Mimari detayları
│   ├── INDICATORS.md      # İndikatör formülleri
│   ├── SETUP.md           # Kurulum rehberi
│   └── CHANGELOG.md       # Değişiklik günlüğü
│
└── data/                  # Çalışma zamanı verileri
    ├── .gitkeep           # Klasörü koru
    ├── signals_ZBCNUSDT.json  # ZBCN sinyal geçmişi
    ├── signals_PROSUSDT.json  # PROS sinyal geçmişi
    ├── paperTrading_ZBCNUSDT.json  # ZBCN PT durumu
    └── paperTrading_PROSUSDT.json  # PROS PT durumu
```

### Veri Akışı

```
KuCoin API ──► server.js (proxy+cache) ──► dashboard.html (client-side analiz)
                      │                           │
                      ▼                           ▼
              CoinGecko API                  Paper Trading API
                      │                      (/api/paper-trading/*)
                      ▼                           │
              data/signals_*.json                 ▼
                                            data/paperTrading_*.json
```

## 📡 API Referansı

### Sağlık ve Yapılandırma

| Endpoint | Metod | Açıklama |
|----------|-------|----------|
| `/api/health` | GET | Sunucu durumu, cache yaşı, semboller |
| `/api/config` | GET | Client yapılandırması |
| `/api/signal-history?symbol=&limit=` | GET | Sinyal geçmişi |
| `/api/signal-stats?symbol=` | GET | Sinyal istatistikleri |
| `/api/log-signal` | POST | Sinyal kaydet |

### Paper Trading

| Endpoint | Metod | Açıklama |
|----------|-------|----------|
| `/api/paper-trading/portfolio?symbol=` | GET | Portföy özeti |
| `/api/paper-trading/positions?symbol=` | GET | Açık pozisyonlar |
| `/api/paper-trading/pending?symbol=` | GET | Bekleyen onaylar |
| `/api/paper-trading/history?symbol=&limit=` | GET | İşlem geçmişi |
| `/api/paper-trading/execute` | POST | İşlem aç |
| `/api/paper-trading/approve` | POST | Emir onayla |
| `/api/paper-trading/reject` | POST | Emir reddet |
| `/api/paper-trading/close` | POST | Pozisyon kapat |
| `/api/paper-trading/check-sl-tp` | POST | SL/TP kontrol |
| `/api/paper-trading/reset` | POST | Sıfırla |
| `/api/paper-trading/set-mode` | POST | Mod değiştir |

### Risk Yönetimi

| Endpoint | Metod | Açıklama |
|----------|-------|----------|
| `/api/risk/parameters` | GET/POST | Risk parametreleri |
| `/api/risk/calculate-position` | POST | Pozisyon hesapla |
| `/api/risk/validate-trade` | POST | Trade doğrulama |
| `/api/risk/check-pause` | GET | Trading duraklatma kontrolü |
| `/api/risk/daily-stats` | GET | Günlük istatistikler |
| `/api/risk/update-pnl` | POST | Günlük PnL güncelle |

### Veri Proxy

| Endpoint | Metod | Açıklama |
|----------|-------|----------|
| `/api/all?symbol=` | GET | Tüm veriler (ticker + orderbook + candles + coingecko) |
| `/api/kucoin/ticker?symbol=` | GET | KuCoin ticker |
| `/api/kucoin/candles?symbol=&type=&limit=` | GET | KuCoin mum verileri |
| `/api/coingecko/price?symbol=` | GET | CoinGecko fiyat |

## 📄 Sinyal Formatı

```json
{
  "signal": "BUY",
  "confidence": 73,
  "weightedScore": 18.5,
  "breakdown": {
    "trend": 45,
    "momentum": 20,
    "volatility": -5,
    "volume": 10,
    "structure": 15
  },
  "tfAlignment": "Kısmi Uyum (AL ağırlıklı)",
  "regime": "Trend-Up",
  "grade": "A",
  "price": 0.0030486,
  "state": "LONG",
  "symbol": "ZBCNUSDT",
  "timestamp": 1779881411913
}
```

### Durum Makinesi (State Machine)

| State | Açıklama |
|-------|----------|
| `LONG` | Güçlü AL sinyali, işlem açılabilir |
| `SHORT` | Güçlü SAT sinyali, işlem açılabilir |
| `WAIT` | Sinyal zayıf, teyit bekleniyor |
| `NO_TRADE` | İşlem önerilmez (Chop, düşük ADX, yüksek volatilite) |

### False Signal Filter

Sinyal şu durumlarda **NO_TRADE** olarak işaretlenir:
- Piyasa rejimi **Chop** ise
- **ADX < 15** (trend yok)
- **ATR% > 8** (aşırı volatilite)
- **Grade C veya NT**
- **Güven < %40**

## 💼 Paper Trading

**Varsayılan çalışma modu: PAPER**

Paper trading, gerçek para kullanmadan sanal portföy üzerinde işlem yapmanızı sağlar.

### Özellikler
- Sanal bakiye (ZBCNUSDT: $10,000 / PROSUSDT: $5,000)
- LONG ve SHORT pozisyonlar
- Stop-loss ve take-profit yönetimi
- Otomatik SL/TP kontrolü
- İşlem onay sistemi (manuel onay)
- Detaylı işlem geçmişi
- Win rate, PnL, getiri takibi

### Live Mode
**Gerçek işlem modu varsayılan olarak KAPALIDIR.** 
- Live mode'a geçmek için `PAPER_TRADING_MODE=live` ayarlanmalıdır
- Tüm işlemler manuel onay gerektirir
- API anahtarları `.env` dosyasından okunur, koda gömülmez

## 🔒 Güvenlik

- **API anahtarları asla koda gömülmez** - `.env` dosyasından okunur
- **Hardcoded secret yok** - Tüm hassas bilgiler environment variable
- **Rate limiting** - 200 istek/dakika
- **CORS** - Yapılandırılabilir origin
- **trust proxy** - Reverse proxy arkasında doğru IP
- **Live trade kapalı** - Varsayılan paper mod
- **Manuel onay** - Live modda tüm işlemler onay gerektirir

## 📝 Lisans

MIT License - SERDOBABA

Bu proje açık kaynak olup aşağıdaki lisanslı paketleri kullanır:
- **Express.js** (MIT) - Web sunucu
- **express-rate-limit** (MIT) - Rate limiting
- **ws** (MIT) - WebSocket
- **nodemon** (MIT) - Geliştirme otomasyonu

## 🤝 Katkı

1. Fork edin
2. Feature branch oluşturun (`git checkout -b feature/yeni-ozellik`)
3. Değişikliklerinizi commit edin (`git commit -m 'feat: yeni özellik'`)
4. Branch'inizi push edin (`git push origin feature/yeni-ozellik`)
5. Pull Request açın

---

⚠️ **Uyarı**: Bu yazılım yatırım tavsiyesi vermez. Kullanımı tamamen kullanıcının sorumluluğundadır.