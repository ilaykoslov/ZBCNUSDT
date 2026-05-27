# ZBCNUSDT - Değişiklik Günlüğü

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