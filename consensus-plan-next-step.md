# Consensus Next Step (Kod Uygulama Öncesi)

## Hedef
Dashboard’daki client-side final karar üretimini devre dışı bırakmak ve server/core tarafında tek karar üretimini yapmak.

## 1) Consensus/Analysis Engine Modülleri
- `core/signals/analysis/SignalComposer.js` (input: candle sets, output: indicator category scores per TF)
- `core/signals/consensus/ConsensusEngine.js` (plugin/strategy ile TF vote + regime/state filters + abstain/no-trade)
- `core/signals/index.js` içine bu modüllerin public export’larını eklemek.

## 2) Server Endpoint
- `server.js`: `GET /api/signal?symbol=ZBCNUSDT` (veya /api/analysis)
  - içeride `/api/all` ile benzer şekilde veriyi çek (ticker/orderbook/candles for 1h/15m/4h)
  - core engine’e veriyi gönder
  - sonucu döndür
  - istenirse `appendSignal()` ile logla.

## 3) Dashboard Entegrasyonu
- `dashboard.html`: `runAnalysis()` içindeki finalSignal karar/score üretimini durdur
- bunun yerine `fetch('/api/signal?symbol='+currentSymbol)` ile gelen payload’u UI alanlarına bas

## 4) Test + Script
- `package.json`: `test:integration` script ekle
- `tests/integration.test.js`: yeni `/api/signal` endpoint testleri ekle

