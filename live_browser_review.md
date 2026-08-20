# Bağlı Chrome Canlı Kullanım Kontrolü

20 Ağustos 2026 tarihinde güncel uygulama bağlı Chrome oturumunda açıldı.

## Doğrulananlar

Uygulama `main` dalındaki güncel kodla çalışıyor. Dashboard canlı fiyat, 24 saatlik ticker, RSI, SMA, MACD, Bollinger, ADX, StochRSI, multi-timeframe, sinyal geçmişi, paper trading ve sembol seçiciyi gösteriyor.

## Bulgu

Üst bardaki yeni veri kalitesi rozeti `Veri: Poor (1787248849s)` şeklinde gerçek dışı bir yaş gösteriyor. Bunun nedeni, `/api/engine-metrics` çağrısının `/api/all` cache güncellemesi tamamlanmadan paralel yapılması veya cache timestamp'inin geçersiz/0 olmasıdır. Bu nedenle veri kalitesi hesaplaması geçersiz timestamp'i `Date.now()` ile fark alarak devasa saniye değeri üretiyor.

Düzeltme kararı: `server.js` geçersiz timestamp'i `Unknown` olarak raporlamalı ve dashboard `api/all` tamamlandıktan sonra engine-metrics çağrısını yapmalıdır. Böylece rozet gerçek gecikme süresini gösterecektir.

## 2026-08-20 Frontend düzeltme doğrulaması

- PROSUSDT seçildiğinde sayfa başlığı `PROSUSDT Canlı Sinyal Dashboard`, H1 `PROSUSDT Sinyal Terminali` oluyor.
- Sembol değişimi sırasında banner geçici olarak `Veriler yükleniyor: PROSUSDT...` gösteriyor; veri geldikten sonra `NÖTR: PROSUSDT ...` olarak güncelleniyor.
- PROS verisi ZBCN'den ayrışıyor: fiyat $0.393200, hacim (PROS) 143.57K, hacim (USDT) $56.85K; kaynak etiketi `Proxy Sunucu (PROSUSDT)`.
- Kategori detaylarındaki `<` ve `>` karakterleri artık satır düzenini bozmadan metin olarak gösteriliyor (`Fiyat<SMA7`, `Tenkan<Kijun`, `MACD<Signal`).
- ZBCN için hacim alanları da doluyor (`312.36M`, `$567.61K`).
- Grafik bölümü metin çıkarımında hâlâ boş görünüyor; iki kaydırma/görsel kontrolde screenshot yüklenemediği için canvas render sonucu kesinleşmedi. Kodda v5 marker/series ve resize uyumluluğu yaması mevcut.

WLFIUSDT doğrulaması: Dinamik başlık `WLFIUSDT Canlı Sinyal Dashboard`, H1 `WLFIUSDT Sinyal Terminali`, banner `NÖTR: WLFIUSDT...`; veri geldikten sonra fiyat $0.060900, hacim (WLFI) 4.30M, hacim (USDT) $262.88K ve kaynak `Proxy Sunucu (WLFIUSDT)` olarak doğru göründü. Kategori satırları düzenli kaldı.
