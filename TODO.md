# ZBCNUSDT - Production-ready sinyal + veri altyapısı planı (TODO)

## 1. Keşif
- [x] Proje ağacı / ana giriş noktalarını tespit et
- [x] server.js endpoint’lerini ve core modülleri okuma
- [x] Sinyal motorunun fiilen dashboard.html client-side’da çalıştığını doğrula

## 2. Sinyal mimarisini tekle
- [ ] `core/signals/signalEngine.js` (yeni):
  - [ ] TF bazlı indicator hesaplarını kullan
  - [ ] Trend/Momentum/Volatility/Volume/Structure skorlarını üret
  - [ ] `core/signals/confluence.js` ile confluence+confidence+grade üret
  - [ ] State machine: LONG/SHORT/WAIT/NO_TRADE üret (determineSignalState)

## 3. Backend endpoint ekle
- [ ] `server.js`: `/api/latest-signal?symbol=` route’u
  - [ ] `/api/all` mantığıyla candles + ticker/orderbook topla
  - [ ] `signalEngine` ile final sinyal üret
  - [ ] Yanıt JSON şemasıyla uyumlu dön (timestamp/state dahil)

## 4. Dashboard güncelleme
- [ ] `dashboard.html`: sinyal hesabını devre dışı bırak
- [ ] `dashboard.html`: `/api/latest-signal` sonucunu çekip UI render et
- [ ] `/api/log-signal`: otomatik loglamayı opsiyonel hale getir (isteğe bağlı)

## 5. Reliability & validation
- [ ] `server.js`: candle validation’ı tüm TF’lere uygula (1h/15m/4h)
- [ ] NaN/null guard + schema validation ekle
- [ ] Cache TTL + stale behavior netleştir

## 6. Testler
- [ ] `tests/integration.test.js`: `/api/latest-signal` testleri ekle
- [ ] `npm test` ve `npm run test:integration` çalıştır

## 7. Prod güvenlik
- [ ] TLS doğrulama (`rejectUnauthorized:false`) kaldır (opsiyonel / env ile)
- [ ] Live trading kapalı kalacak şekilde manuel onay akışını doğrula

