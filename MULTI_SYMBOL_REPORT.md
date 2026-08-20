# ZBCNUSDT Sinyal Terminali - Canlı Grafik ve Performans Raporu

## Yapılan Geliştirmeler

**1. İnteraktif Canlı Grafik (Lightweight Charts)**
Eski, statik ve SVG tabanlı basit çizgi grafiği yerine profesyonel **Lightweight Charts** kütüphanesi entegre edildi.
- 48 saatlik mum grafikleri (Candlestick) ve hacim çubukları (Histogram) aynı ekranda birleştirildi.
- Sinyal motoru AL (BUY) veya SAT (SELL) sinyali ürettiğinde, bu sinyal anında grafik üzerinde ilgili mumun altına/üstüne **ok işareti (Marker)** ile yerleştiriliyor.

**2. Veri Kalitesi ve Gecikme Takibi (Data Quality)**
Kripto analizlerinde bayat (stale) verilerle işlem yapmak tehlikelidir. Bu nedenle dashboard'un sol üst köşesine canlı bir **Veri Kalitesi Rozeti** eklendi.
- Backend, KuCoin'den veriyi en son ne zaman çektiğini hesaplıyor.
- Veri gecikmesi 10 saniyenin altındaysa "Excellent", 30 saniyenin altındaysa "Good" olarak renkli şekilde arayüze yansıtılıyor.

**3. Motor Öğrenme ve Cooldown Uyarıları**
Sinyal motorunun arka planda ne düşündüğünü daha iyi görebilmek için UI güncellendi.
- Motor üst üste hatalı sinyal verip **Cooldown (Soğuma)** moduna girerse, sinyal kartında sarı bir ❄️ COOLDOWN uyarısı beliriyor.
- Motorun hangi indikatör grubunda yanıldığı (Trend, Momentum, Volatilite vb.) detaylı analiz sekmesinde **Motor Öğrenme Hataları** tablosuyla gösteriliyor.

**4. Tüm Semboller İçin Performans API'si**
Backend tarafına `/api/performance` adlı yeni bir uç nokta (endpoint) eklendi. Bu API, ZBCN, PROS, WLFI ve SOL için:
- Toplam değerlendirilen sinyal sayısını,
- Başarılı (Win) ve Başarısız (Loss) işlem sayılarını,
- Gerçekleşmiş isabet oranını (Evaluated Accuracy) tek bir JSON yanıtında sunuyor.

## Test ve Güvenlik
Tüm bu eklemeler, entegrasyon testlerine (43/43 başarılı test) dâhil edildi ve uygulamanın mevcut hiçbir özelliği (Paper Trading, Sinyal Kayıtları vb.) kırılmadan `main` dalına aktarıldı.
