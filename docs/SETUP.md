# ZBCNUSDT - Kurulum ve Yapılandırma

## 🚀 Hızlı Başlangıç

### Gereksinimler
- Node.js >= 18.0.0
- npm >= 9.0.0
- Internet bağlantısı (API verileri için)

### Adımlar

```bash
# 1. Projeyi klonla veya indir
cd ZBCNUSDT

# 2. Bağımlılıkları yükle
npm install

# 3. Sunucuyu başlat
npm start
```

### Docker ile Kurulum

```bash
# Docker Compose ile
docker compose up -d

# veya Docker ile
docker build -t zbcnusdt .
docker run -d -p 3456:3456 --name zbcnusdt zbcnusdt
```

## ⚙️ Yapılandırma

### .env Dosyası

`.env.example` dosyasını `.env` olarak kopyala:

```bash
cp .env.example .env
```

### Mevcut Ayarlar

| Değişken | Varsayılan | Açıklama |
|----------|------------|----------|
| PORT | 3456 | Sunucu portu |
| API_TIMEOUT | 15000 | API timeout (ms) |
| REFRESH_MS | 15000 | Dashboard yenileme (ms) |
| BUY_THRESHOLD | 12 | BUY sinyal eşiği |
| SELL_THRESHOLD | -12 | SELL sinyal eşiği |
| ALLOWED_ORIGINS | * | CORS origin'leri |

### Yapılandırma Değişikliği

`.env` dosyasını düzenle:

```env
PORT=3456
API_TIMEOUT=15000
REFRESH_MS=15000
BUY_THRESHOLD=12
SELL_THRESHOLD=-12
ALLOWED_ORIGINS=https://yourdomain.com
```

## 📊 Dashboard Kullanımı

### Erişim
```
http://localhost:3456
```

### Dashboard Bileşenleri

1. **Price Hero**
   - Anlık fiyat
   - 24s değişimi
   - Yüksek/Düşük
   - Hacim
   - Piyasa değeri

2. **Sinyal Kartı**
   - BUY/SELL/NEUTRAL
   - Güven skoru
   - TF uyumu

3. **İndikatör Panelleri**
   - RSI (14)
   - SMA (7, 25, 99)
   - MACD
   - Bollinger Bands
   - ADX
   - StochRSI
   - Divergence
   - Support/Resistance

4. **Multi-Timeframe**
   - 15m sinyali
   - 1h sinyali
   - 4h sinyali
   - TF uyumu

5. **Sinyal Geçmişi**
   - Son 30 sinyal
   - Tarih, sinyal, güven, skor

## 🔌 API Kullanımı

### Health Check
```bash
curl http://localhost:3456/api/health
```

### Tüm Veriler
```bash
curl http://localhost:3456/api/all
```

### Yapılandırma
```bash
curl http://localhost:3456/api/config
```

### Sinyal Geçmişi
```bash
curl http://localhost:3456/api/signal-history?limit=30
```

### Sinyal Kaydet
```bash
curl -X POST http://localhost:3456/api/log-signal \
  -H "Content-Type: application/json" \
  -d '{"signal":"BUY","confidence":80,"weightedScore":25.5}'
```

## 🧪 Test

### Hızlı Test
```bash
npm test
```

### Kapsamlı Test
```bash
npm run test:full
```

### Entegrasyon Testi
Sunucu ayrı bir terminalde çalışırken API ve paper-trading akışını doğrular:

```bash
npm run test:integration
```

Tüm test gruplarını arka arkaya çalıştırmak için:

```bash
npm run test:all
```

### Sağlık Kontrolü
```bash
npm run health
```

## 📁 Proje Yapısı

```
ZBCNUSDT/
├── server.js              # Express proxy sunucu
├── config.js              # Merkezi yapılandırma
├── dashboard.html         # Client-side dashboard
├── package.json           # npm bağımlılıkları
├── .env.example           # Environment şablonu
├── docker-compose.yml     # Docker yapılandırması
├── Dockerfile             # Docker image
├── AGENTS.md              # Workspace kuralları
├── docs/                  # Dokümantasyon
│   ├── ARCHITECTURE.md    # Mimari
│   ├── INDICATORS.md      # İndikatörler
│   └── SETUP.md           # Bu dosya
├── core/                  # Core modüller
│   ├── indicators/        # Teknik indikatörler
│   ├── signals/           # Sinyal üretimi
│   └── backtest/          # Backtest modülü
├── api/                   # API modülleri
│   └── realtime.js        # WebSocket
├── utils/                 # Yardımcı modüller
│   └── webhook.js         # Telegram webhook
├── data/
│   └── signals.json       # Sinyal geçmişi
└── test_signal.*          # Test dosyaları
```

## 🔄 Otomatik Yenileme

Dashboard otomatik olarak her 15 saniyede bir güncellenir:
- Veri çekme
- Analiz
- Sinyal üretimi
- UI güncelleme

### Manuel Yenileme
Dashboard'da "⟳ Yenile" butonuna tıkla.

### Visibility Change
Sayfa gizlendiğinde yenileme durur, görünür olduğunda tekrar başlar.

## ⚠️ Sorun Giderme

### Port Zaten Kullanımda
```bash
# Windows
netstat -ano | findstr :3456
taskkill /PID <PID> /F

# Linux/Mac
lsof -i :3456
kill -9 <PID>
```

### API Bağlantı Hatası
- Internet bağlantısını kontrol et
- KuCoin API durumunu kontrol et
- API timeout değerini artır

### Sinyal Üretilmiyor
- Veri miktarını kontrol et (en az 30 mum gerekli)
- Console'da hata var mı kontrol et
- Network tablosunda API isteklerini kontrol et

## 📝 Lisans

MIT License - ilaykoslov