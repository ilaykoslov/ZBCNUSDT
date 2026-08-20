# ZBCNUSDT Sinyal Terminali

**ZBCNUSDT Sinyal Terminali**, KuCoin ve CoinGecko verilerini bir araya getirerek teknik analiz, çoklu zaman dilimi uyumu, sinyal geçmişi ve güvenli paper-trading simülasyonu sunan Node.js tabanlı bir dashboard uygulamasıdır.

> Bu proje eğitim ve araştırma amaçlıdır. Üretilen sinyaller yatırım tavsiyesi değildir. Varsayılan işlem modu **paper trading** olup gerçek emir gönderimi kapalıdır.

## Projenin amacı

Uygulama, piyasa verisini tek bir dashboard üzerinde görünür kılmayı ve farklı teknik göstergeleri ortak bir sinyal puanında birleştirmeyi hedefler. Sistem; 15 dakika, 1 saat ve 4 saat zaman dilimlerini karşılaştırır, piyasa rejimini sınıflandırır ve sinyal geçmişini dosya tabanlı olarak saklar.

| Alan | Açıklama |
|---|---|
| Veri kaynakları | KuCoin ticker, level2 orderbook, çoklu zaman dilimi mumları ve CoinGecko fiyat bilgileri |
| Analiz | RSI, MACD, SMA, EMA, Bollinger Bands, ADX, ATR, OBV, Ichimoku, StochRSI, VWAP, Keltner, Supertrend, divergence ve pivotlar |
| Sembol motoru | Her sembol için volatilite rejimi, dinamik TP/SL, cooldown, kategori öğrenme ağırlıkları ve mikro-yapı profili |
| Zaman dilimleri | 15 dakika, 1 saat ve 4 saat |
| Sinyal çıktısı | BUY, SELL, NEUTRAL; ayrıca WAIT, LONG, SHORT ve NO_TRADE durumları |
| İşlem simülasyonu | Paper portföy, pozisyonlar, SL/TP, işlem geçmişi ve risk kontrolleri |
| Güncelleme | Polling yedeğiyle birlikte WebSocket tabanlı canlı güncelleme |
| Bildirim | Telegram ve Discord webhook desteği |

## Hızlı başlangıç

### Gereksinimler

- Node.js 18 veya daha yeni bir sürüm
- npm 9 veya daha yeni bir sürüm
- KuCoin ve CoinGecko uç noktalarına internet erişimi

### Kurulum

```bash
git clone https://github.com/ilaykoslov/ZBCNUSDT.git
cd ZBCNUSDT
npm install
cp .env.example .env
npm start
```

Tarayıcıdan [http://localhost:3456](http://localhost:3456) adresini açın. Geliştirme sırasında `npm run dev` komutu da kullanılabilir.

## Komutlar

| Komut | Kullanım amacı |
|---|---|
| `npm start` | Üretim benzeri sunucu başlatma |
| `npm run dev` | Yerel geliştirme sunucusu |
| `npm run dev:watch` | Dosya değişikliklerinde otomatik yeniden başlatma |
| `npm test` | Dashboard analiz fonksiyonlarını hızlı test etme |
| `npm run test:full` | Geniş kapsamlı indikatör ve analiz testi |
| `npm run test:integration` | Sunucu, API, paper trading ve risk uç noktalarını test etme |
| `npm run test:all` | Tüm test gruplarını sırasıyla çalıştırma |
| `npm run health` | Çalışan sunucunun sağlık durumunu sorgulama |

`npm test`, `npm run test:full` ve entegrasyon testleri veri uç noktalarına veya çalışan sunucuya ihtiyaç duyabilir. Entegrasyon testinden önce `npm start` komutunu ayrı bir terminalde çalıştırın.

## Desteklenen semboller

Semboller ve başlangıç paper bakiyeleri `config.js` içindeki `symbols` bölümünden yönetilir.

| Sembol | KuCoin karşılığı | CoinGecko kimliği | Başlangıç bakiyesi |
|---|---|---|---:|
| ZBCNUSDT | ZBCN-USDT | zebec-network | 10.000 USDT |
| PROSUSDT | PROS-USDT | pharos-network | 5.000 USDT |
| WLFIUSDT | WLFI-USDT | wlfi | 5.000 USDT |
| SOLUSDT | SOL-USDT | solana | 5.000 USDT |

Yeni sembol eklerken KuCoin sembolünü, CoinGecko kimliğini, görünen adı ve paper-trading durum dosyasını birlikte tanımlayın. Sembolün piyasa karakterine göre `specialSettings` altında eşik, kategori ağırlığı, zaman dilimi, güven ve indikatör ayarlarını da tanımlayın. Ortak öğrenme ve değerlendirme motoru `core/signals/symbolEngine.js` üzerinden sembol bazlı JSON durum dosyaları üretir.

## Yapılandırma

Ortak analiz ve sunucu ayarları `config.js` dosyasındadır. Hassas bilgiler `.env` dosyasından okunmalıdır; `.env` dosyası Git’e gönderilmemelidir.

| Değişken | Varsayılan | Açıklama |
|---|---|---|
| `PORT` | `3456` | HTTP sunucusunun portu |
| `HOST` | `0.0.0.0` | Sunucunun dinlediği adres |
| `ACTIVE_SYMBOL` | `ZBCNUSDT` | Başlangıçta seçilen sembol |
| `PAPER_TRADING_MODE` | `paper` | İşlem modu; varsayılan güvenli mod |
| `ALLOWED_ORIGINS` | `*` | CORS kaynakları |
| `ALERTS_ENABLED` | kapalı | Bildirim sistemini etkinleştirir |

Telegram, Discord veya canlı işlem entegrasyonlarını etkinleştirmeden önce `.env.example` dosyasını ve [SETUP.md](docs/SETUP.md) rehberini inceleyin.

## API özeti

Sunucu, dashboard’un kullandığı veri ve işlem uç noktalarını sağlar.

| Endpoint | Metot | Açıklama |
|---|---:|---|
| `/api/health` | GET | Sunucu, cache ve sembol durumu |
| `/api/config` | GET | İstemciye gönderilen yapılandırma |
| `/api/all?symbol=ZBCNUSDT` | GET | Ticker, mum, order book ve CoinGecko verisi |
| `/api/signal?symbol=ZBCNUSDT` | GET | Sinyal motorunun güncel çıktısı |
| `/api/signal-history?symbol=ZBCNUSDT` | GET | Sinyal geçmişi |
| `/api/engine-metrics?symbol=ZBCNUSDT` | GET | Veri kalitesi, cooldown, kategori hata ve öğrenme metrikleri |
| `/api/performance` | GET | Tüm sembollerin gerçek değerlendirme performans özeti |
| `/api/paper-trading/portfolio?symbol=ZBCNUSDT` | GET | Paper portföy özeti |
| `/api/risk/parameters` | GET | Risk parametreleri |

Tüm uç noktaların ayrıntılı listesi ve örnek payload’lar için [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) dosyasına bakın.

## Proje yapısı

```text
ZBCNUSDT/
├── api/                 # KuCoin realtime ve API yardımcıları
├── core/                # Sinyal, indikatör, risk, veri ve paper-trading modülleri
│   └── signals/         # Confluence, ortak symbolEngine ve geriye dönük ZBCN adaptörü
├── data/                # Çalışma zamanı JSON dosyaları
├── docs/                # Mimari, kurulum, indikatör ve sürüm dokümanları
├── tests/               # Entegrasyon testi ve sinyal şeması
├── dashboard.html       # Modern trading terminali arayüzü ve istemci analiz katmanı
├── ZBCN_ALGORITHM_DESIGN.md # Sembol motoru ve değerlendirme tasarımı
├── server.js            # Express proxy, cache, WebSocket ve API uç noktaları
├── config.js            # Merkezi yapılandırma
└── package.json         # Script ve bağımlılık tanımları
```

## Geliştirme ilkeleri

Kod değişikliklerinde küçük ve geri alınabilir commit’ler tercih edilir. Yeni endpoint veya sinyal alanı eklenirse ilgili test, README/API dokümanı ve gerekirse `tests/test_schema.json` birlikte güncellenmelidir. Gerçek para ile işlem yapmadan önce paper-trading akışı ve risk kontrolleri doğrulanmalıdır.

Katkı süreci için [CONTRIBUTING.md](CONTRIBUTING.md), ayrıntılı kurulum için [docs/SETUP.md](docs/SETUP.md), mimari için [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) ve indikatör açıklamaları için [docs/INDICATORS.md](docs/INDICATORS.md) dosyalarını okuyun.

## Lisans

Bu proje MIT lisansı ile yayımlanmıştır. Ayrıntılar için [LICENSE](LICENSE) dosyasına bakın.

## Kaynaklar

- [KuCoin API Documentation](https://www.kucoin.com/docs)
- [CoinGecko API Documentation](https://docs.coingecko.com/)
- [Express.js Documentation](https://expressjs.com/)
- [Node.js Documentation](https://nodejs.org/docs/latest/api/)
