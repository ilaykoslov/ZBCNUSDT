# ZBCNUSDT - Değişiklik Günlüğü

## [Unreleased] - 2026-08-20

### ZBCN Özel Sinyal Motoru ve Canlı Geri Besleme (Learning Engine)

- `core/signals/zbcnEngine.js` eklendi. ZBCN'in KuCoin geçmiş verileri üzerinden ölçülen anlık volatilitesi (ATR%) baz alınarak ZBCN'e özel piyasa rejimi algılama (Volatile-Chop, Volatile-Trend, Low-Vol-Range) uygulandı.
- `server.js` içine arka planda çalışan (Background Evaluation Loop) bir geriye dönük test (backtest) mekanizması eklendi. Üretilen her ZBCN sinyali 4 saat sonra gelecek fiyat hareketleriyle (Take Profit %2, Stop Loss %1) değerlendirilerek başarılı/başarısız olarak etiketleniyor.
- `zbcn_eval.json` çalışma zamanı veri dosyası ile motorun geçmiş isabet oranı (Historical Accuracy) kalıcı olarak saklanıyor.
- İsabet oranı %40'ın altına düştüğünde, ZBCN motoru yeni üretilen sinyallerin ağırlık skorunu %20 oranında cezalandırarak yanlış sinyal tekrarını önleyen bir öğrenme (learning penalty) katmanı eklendi.
- Dashboard arayüzü (`dashboard.html`), backend tarafından `/api/all` üzerinden iletilen `historicalAccuracy` bilgisini canlı veri akışında (polling ve websocket uyumlu) gösterecek şekilde güncellendi. Sinyal kartına "Motor İsabeti" satırı eklendi.

### Dokümantasyon ve depo bakımı

- Ana README; proje amacı, hızlı başlangıç, yapılandırma, API özeti, test komutları ve proje yapısını açıklayacak şekilde yeniden düzenlendi.
- Kurulum, mimari ve dokümantasyon indeksleri güncellendi; `CONTRIBUTING.md` ve `LICENSE` dosyaları eklendi.
- `TODO.md`, geçmiş çalışma kontrol listesi ile gelecek geliştirme yol haritasını ayıracak şekilde düzenlendi.
- `package.json` içindeki depo sahibi, repository, issue ve homepage bağlantıları güncel GitHub adresine taşındı.
- `test:integration` ve `test:all` npm script’leri dokümantasyonla uyumlu hâle getirildi.

## [2.2.0] - 2026-05-27

### 🎉 Yeni Özellikler

#### Modüler Yapı
- `core/` klasör yapısı
  - `core/indicators/` - Teknik indikatörler
  - `core/signals/` - Sinyal üretimi
  - `core/backtest/` - Backtest modülü
- `api/` klasör yapısı
  - `api/realtime.js` - WebSocket entegrasyonu
- `utils/` klasör yapısı
  - `utils/webhook.js` - Telegram/Discord webhook

#### Yeni İndikatörler
- **Ichimoku Cloud** - Gökkuşağı grafik
- **Williams %R** - Aşırı alım/satım
- **CCI** - Commodity channel index
- **VWAP** - Hacim ağırlıklı ortalama fiyat
- **Volume Profile** - Hacim profili

#### WebSocket Entegrasyonu
- KuCoin WebSocket desteği
- Gerçek zamanlı fiyat güncellemeleri
- Orderbook güncellemeleri
- Kline güncellemeleri
- Otomatik yeniden bağlanma

#### Backtest Modülü
- Historik veri testi
- RSI, SMA, MACD stratejileri
- Win rate, profit factor, max drawdown

#### Webhook Sistemi
- Telegram webhook
- Discord webhook
- Email webhook (SMTP fallback)

### 🔧 İyileştirmeler

#### Yapılandırma
- `.env.example` güncellendi
- CORS environment variable'dan yapılandırılabilir
- Rate limiting eklendi (100 istek/dakika)

#### Test
- `test_signal.mjs` düzeltildi
- Indirect eval kullanılarak fonksiyonlar doğru şekilde yükleniyor

### 🐛 Düzeltmeler

- `baseWeights` global tanımı eklendi
- `gradeBadge` DOM elementi eklendi
- CORS header'ı yapılandırılabilir hale getirildi
- Rate limiting middleware eklendi
- Error handling middleware eklendi

### 📦 Bağımlılıklar

**Yeni:**
- `express-rate-limit` - Rate limiting
- `ws` - WebSocket

**Güncellenen:**
- `package.json` - Versiyon 2.2.0

## [2.1.0] - Önceki Versiyon

### Özellikler
- Multi-timeframe confluence analizi
- 10+ teknik indikatör
- Real-time dashboard
- Sinyal geçmişi
- KuCoin ve CoinGecko entegrasyonu

### İndikatörler
- SMA, EMA, RSI, MACD
- Bollinger Bands, ATR
- Stochastic RSI, OBV
- ADX, Divergence
- Support/Resistance, Pivot Levels

## 📝 Notlar

- Tüm versiyonlar geriye dönük uyumludur
- `.env` dosyası manuel olarak güncellenmelidir
- Docker image'ları otomatik olarak yeniden oluşturulur