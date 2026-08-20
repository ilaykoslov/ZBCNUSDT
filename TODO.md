# Geliştirme Yol Haritası

> Bu dosyada üstteki canlı dashboard çalışmasının geçmiş kontrol listesi korunur. Yeni geliştirmeler aşağıdaki yol haritasında takip edilir.

## 1) Planı uygula
- [ ] Server tarafına WebSocket (ws) endpoint ekle
- [ ] `api/realtime.js` içindeki KuCoin realtime client(lar)ı server’a bağla
- [ ] `dataCaches` içine realtime veriyi yaz
- [ ] Değişen veri/sinyal için throttled push yap
- [x] `dashboard.html` push kanalına bağlanıp anlık UI güncelle
- [x] Fallback olarak polling’i koru (WS koparsa)


## 2) Test / Doğrulama
- [x] `npm test` çalıştır
- [x] sunucuyu ayağa kaldır
- [x] dashboard’da veri değişimini F5’siz anlık doğrula

## 3) Backend Sinyal (Source of Truth)
- [x] `GET /api/signal?symbol=...` endpoint ekle
- [ ] 1h/15m/4h candles ile backend indikatörleri hesapla
- [ ] TF bazlı BUY/SELL/NEUTRAL + confluence/regime/grade üret
- [ ] False-signal azaltma için state/guard (NO_TRADE/WAIT) ekle
- [ ] Sinyal payload formatını `tests/test_schema.json` ile uyumlu hale getir

## 4) Backend İndikatör Tamamlama
- [x] `core/indicators/index.js` exportları tamam (RSI/MACD/SMA/EMA/ADX/BB/ATR/OBV + özel indikatörler)
- [x] Gerekli indikatör modülleri dahil (ichimoku/williamsR/cci/vwap/volumeProfile/keltner/supertrend)
- [x] NaN/null & veri uzunluğu guard’ları eklendi (best-effort null döndürme + min length kontrolleri)

## 5) Dashboard Render Moduna Geçiş
- [x] dashboard.html runAnalysis/indicator hesapları korundu; backend sinyali WS `signalChange` ile UI’ya basılıyor
- [x] WS `signalChange` payload alanları (signal/confidence/tfAlignment) UI ile eşleşiyor
- [x] WS tarafı koparsa polling fallback mevcut (F5’siz anlık)

## 6) Canlı Push / WS Sinyal Tetikleme
- [x] realtime.js TF abonelikleri var (1min/5min/15min/1hour/4hour) ve message handler ile veri normalize ediliyor
- [x] WS üzerinden `signalChange` broadcast zaten server.js içinde var ve dashboard tarafından tüketiliyor
- [x] WS koparsa polling devam ediyor

## 7) Entegrasyon Testleri
- [x] `/api/signal` endpoint testi mevcut (en azından schema uyumlu sinyal akışı için kapsamda)
- [x] payload schema validation için `tests/test_schema.json` referans standardize edildi
- [x] rate-limit/timeout test altyapısı mevcut (`express-rate-limit` + timeout testleri)



## Sonraki geliştirmeler

### Sinyal motoru

- [ ] Client-side analiz ile backend sinyal motoru sonuçlarını aynı test verisi üzerinde karşılaştırmak.
- [ ] Eşik, ağırlık ve rejim kararlarını taşınabilir strateji yapılandırmasına dönüştürmek.
- [ ] Sembol ve zaman dilimi bazlı sinyal cooldown mekanizması eklemek.
- [ ] Geçmiş veriler üzerinde otomatik backtest raporu üretmek.

### Veri güvenilirliği

- [ ] KuCoin rate-limit yanıtları için `Retry-After` desteği eklemek.
- [ ] Harici API yanıtlarına şema doğrulaması uygulamak.
- [ ] JSON çalışma zamanı dosyaları için atomik yazma ve bozulma kurtarma akışı eklemek.
- [ ] Cache durumunu sembol ve zaman dilimi bazında ayrıntılandırmak.

### Dashboard deneyimi

- [ ] Sinyal, rejim, risk ve veri tazeliğini tek özet kartında birleştirmek.
- [ ] Mobil görünümde tablo ve grafik kullanılabilirliğini iyileştirmek.
- [ ] Sembol ve görünüm tercihlerini yerel olarak saklamak.
- [ ] WebSocket bağlantı durumunu erişilebilir bir durum göstergesiyle sunmak.

### Operasyon ve kalite

- [ ] API ve UI için ayrı smoke test senaryoları eklemek.
- [ ] Log seviyelerini yapılandırılabilir hâle getirmek.
- [ ] Docker healthcheck ve graceful shutdown davranışını doğrulamak.
- [ ] Bağımlılık güncellemelerini CI içinde düzenli olarak doğrulamak.
