# TODO - Canlı Dashboard (Anlık Push)

## 1) Planı uygula
- [ ] Server tarafına WebSocket (ws) endpoint ekle
- [ ] `api/realtime.js` içindeki KuCoin realtime client(lar)ı server’a bağla
- [ ] `dataCaches` içine realtime veriyi yaz
- [ ] Değişen veri/sinyal için throttled push yap
- [x] `dashboard.html` push kanalına bağlanıp anlık UI güncelle
- [x] Fallback olarak polling’i koru (WS koparsa)


## 2) Test / Doğrulama
- [ ] `npm test` çalıştır
- [ ] sunucuyu ayağa kaldır
- [ ] dashboard’da veri değişimini F5’siz anlık doğrula

## 3) Backend Sinyal (Source of Truth)
- [x] `GET /api/signal?symbol=...` endpoint ekle
- [ ] 1h/15m/4h candles ile backend indikatörleri hesapla
- [ ] TF bazlı BUY/SELL/NEUTRAL + confluence/regime/grade üret
- [ ] False-signal azaltma için state/guard (NO_TRADE/WAIT) ekle
- [ ] Sinyal payload formatını `tests/test_schema.json` ile uyumlu hale getir

## 4) Backend İndikatör Tamamlama
- [ ] `core/indicators/index.js` exportlarını tamamla (RSI/MACD/SMA/EMA/ADX/BB/ATR/OBV eksikleri)
- [ ] Gerekli indikatör modüllerini ekle (backend hesaplama için)
- [ ] İndikatör hesaplarında NaN/null güvenliği ve veri uzunluğu guard’ları ekle

## 5) Dashboard Render Moduna Geçiş
- [ ] dashboard.html içindeki runAnalysis/indicator hesaplarını devre dışı bırak veya “backendEnabled” flag ile kapat
- [ ] `GET /api/signal` veya WS `signalChange` payload’ını UI’ya bas
- [ ] WS payload alanlarının (ticker/orderbook/candles/signal) UI ile eşleşmesini düzelt

## 6) Canlı Push / WS Sinyal Tetikleme
- [ ] `api/realtime.js` içinde topic→TF map’i doğru olacak şekilde düzelt
- [ ] throttled debounce ile signal üretimini sınırlı yap
- [ ] WS üzerinden `signalChange` broadcast’ı dashboard tarafından sorunsuz tüketilsin

## 7) Entegrasyon Testleri
- [ ] `tests/integration.test.js` içine `/api/signal` endpoint testleri ekle
- [ ] payload schema validation ekle
- [ ] rate-limit/timeout için test senaryoları ekle

