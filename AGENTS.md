# Repository Guidelines

## Project Structure & Module Organization

Two-tier architecture: **Express.js proxy sunucu** (`server.js`) dış API'leri (KuCoin, CoinGecko) toplar, client'a tek bir `/api/all` endpoint'inde birleştirir. **Tüm sinyal mantığı client-side** (`dashboard.html` içindeki JavaScript) çalışır — sunucu sadece proxy, cache ve sinyal geçmişi persistence'ından sorumludur.

- `config.js` — merkezi yapılandırma (port, API URL'leri, indikatör parametreleri, eşik değerler, ağırlıklar). Client `/api/config` ile okur.
- `server.js` — Express 5.2.1, 10+ endpoint, bellek içi cache (`dataCache`), sinyal loglama (`appendSignal` → `data/signals.json`).
- `dashboard.html` — 1630 satır tek dosya: UI + 10+ indikatör fonksiyonu + 5 kategorili skorlama + multi-TF analizi.
- `test_signal.cjs` / `test_signal.mjs` — DOM mock ile client-side fonksiyonları headless test eder.

## Build, Test, and Development Commands

```bash
npm start          # Üretim: server.js başlat (localhost:3456)
npm run dev        # Geliştirme: server.js başlat
npm run dev:watch  # Geliştirme: nodemon ile otomatik yeniden başlatma
npm test           # test_signal.cjs çalıştır (hızlı doğrulama)
npm run test:full  # test_signal.mjs çalıştır (kapsamlı)
npm run health     # Sunucu sağlık kontrolü
```

## Coding Style & Naming Conventions

- **CommonJS** (`require`/`module.exports`). Single `config.js` export.
- **Client-side JS:** tek `dashboard.html` `<script>` bloğu, global fonksiyonlar. İndikatör fonksiyonları `calculate*` önekiyle (`calculateSMA`, `calculateRSI`, `calculateADX`).
- **DOM element ID'leri:** camelCase (`rsiValue`, `adxStatus`, `signalBadge`).
- **API yanıtları:** snake_case (`weightedScore`, `tfAlignment`, `categoryWeights`).
- **Sunucu cache:** `dataCache = { data: null, timestamp: 0 }`. Cache hit → `_cached: true`, `_cachedAge`.
- **Hata toleransı:** Tüm API çağrıları `fetchSafe` wrapper ile sarılı, başarısız olanlar diğerlerini etkilemez.

## Testing Guidelines

- **headless test:** `test_signal.cjs` — DOM mock ile client-side indikatörleri live KuCoin verisi üzerinde test eder. `npm test` ile çalışır.
- **kapsamlı test:** `test_signal.mjs` — ES module, detaylı çıktı, tüm indikatör fonksiyonlarını ayrı ayrı raporlar.
- **manuel doğrulama:** `http://localhost:3456` açılır, tarayıcı konsolunda hata kontrolü, sinyal kartında BUY/SELL/NEUTRAL görülmeli.
- **önbellek testi:** Sunucu loglarında `CACHE HIT` mesajı görülmeli; sayfa yenilendiğinde `_cached: true` flag'i gelmeli.

## Commit & Pull Request Guidelines

- **Commit formatı:** `feat:`, `fix:`, `chore:`, `docs:`, `refactor:` önekleri (conventional commits).
- **Branch stratejisi:** `main` (kararlı), `dev` (geliştirme). Feature branch'ler `dev`'den ayrılır.
- **PR template:** `.github/PULL_REQUEST_TEMPLATE.md` — checklist ile kod kalitesi, test, UI doğrulama adımları.
- **CI:** Push/PR'de GitHub Actions: `npm ci` + `npm test` + CodeQL güvenlik taraması.
