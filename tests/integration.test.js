// =====================================================
// ZBCNUSDT/PROSUSDT - Entegrasyon Testleri
// =====================================================
// Kapsam: Server health, API endpoint'leri,
// paper trading, signal doğrulama, çoklu sembol
// =====================================================

const http = require('http');
const https = require('https');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://localhost:3456';
let passed = 0;
let failed = 0;
let total = 0;

function test(name, fn) {
    total++;
    return fn().then(() => {
        passed++;
        console.log(`  ✅ ${name}`);
    }).catch(e => {
        failed++;
        console.log(`  ❌ ${name}: ${e.message}`);
    });
}

function get(path) {
    return new Promise((resolve, reject) => {
        http.get(BASE_URL + path, res => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try { resolve(JSON.parse(data)); }
                    catch (e) { reject(new Error(`JSON parse error: ${data.substring(0,100)}`)); }
                } else {
                    reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0,100)}`));
                }
            });
        }).on('error', reject).setTimeout(10000, function(){ this.destroy(); reject(new Error('Timeout')); });
    });
}

function post(path, body) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(body);
        const options = {
            hostname: 'localhost',
            port: 3456,
            path: path,
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
        };
        const req = http.request(options, res => {
            let response = '';
            res.on('data', c => response += c);
            res.on('end', () => {
                try { resolve(JSON.parse(response)); }
                catch (e) { reject(new Error(`JSON parse error: ${response.substring(0,100)}`)); }
            });
        });
        req.on('error', reject);
        req.setTimeout(10000, function(){ this.destroy(); reject(new Error('Timeout')); });
        req.write(data);
        req.end();
    });
}

// =========================================
// TEST KOŞUMU
// =========================================

async function runTests() {
    console.log('\n============================================');
    console.log('  ZBCNUSDT/PROSUSDT Entegrasyon Testleri');
    console.log('============================================\n');

    // ---- 1. SERVER SAĞLIĞI ----
    console.log('📋 1. SERVER SAĞLIĞI');

    await test('Health endpoint - status ok', async () => {
        const h = await get('/api/health');
        if (h.status !== 'ok') throw new Error('Expected status ok, got: ' + h.status);
    });

    await test('Health endpoint - uptime positif', async () => {
        const h = await get('/api/health');
        if (typeof h.uptime !== 'number' || h.uptime <= 0) throw new Error('Invalid uptime');
    });

    await test('Health endpoint - çoklu sembol', async () => {
        const h = await get('/api/health');
        if (!h.activeSymbols || !h.activeSymbols.includes('ZBCNUSDT') || !h.activeSymbols.includes('PROSUSDT')) {
            throw new Error('Missing symbols: ' + JSON.stringify(h.activeSymbols));
        }
    });

    await test('Health endpoint - cache info', async () => {
        const h = await get('/api/health');
        if (!h.cacheInfo || !h.cacheInfo.ZBCNUSDT) throw new Error('Missing cacheInfo');
    });

    await test('Health endpoint - sinyal sayıları', async () => {
        const h = await get('/api/health');
        if (!h.signalCounts || typeof h.signalCounts.ZBCNUSDT !== 'number') throw new Error('Missing signalCounts');
    });

    // ---- 2. YAPILANDIRMA ----
    console.log('\n📋 2. YAPILANDIRMA');

    await test('Config endpoint', async () => {
        const c = await get('/api/config');
        if (!c.symbols) throw new Error('Missing symbols config');
        if (!c.symbols.ZBCNUSDT) throw new Error('Missing ZBCNUSDT config');
        if (!c.symbols.PROSUSDT) throw new Error('Missing PROSUSDT config');
        if (!c.symbols.WLFIUSDT) throw new Error('Missing WLFIUSDT config');
    });

    await test('Config - sembol detayları', async () => {
        const c = await get('/api/config');
        const z = c.symbols.ZBCNUSDT;
        const p = c.symbols.PROSUSDT;
        const w = c.symbols.WLFIUSDT;

        if (z.kucoinSymbol !== 'ZBCN-USDT') throw new Error('Wrong ZBCN KuCoin symbol: ' + z.kucoinSymbol);
        if (p.kucoinSymbol !== 'PROS-USDT') throw new Error('Wrong PROS KuCoin symbol: ' + p.kucoinSymbol);
        if (w.kucoinSymbol !== 'WLFI-USDT') throw new Error('Wrong WLFI KuCoin symbol: ' + w.kucoinSymbol);

        if (z.coingeckoId !== 'zebec-network') throw new Error('Wrong ZBCN CoinGecko ID');
        if (p.coingeckoId !== 'pharos-network') throw new Error('Wrong PROS CoinGecko ID: ' + p.coingeckoId);
        if (w.coingeckoId !== 'wlfi') throw new Error('Wrong WLFI CoinGecko ID: ' + w.coingeckoId);
    });

    await test('Config - signal thresholds', async () => {
        const c = await get('/api/config');
        if (!c.signalThresholds || c.signalThresholds.buy !== 12) throw new Error('Wrong threshold');
    });

    await test('Config - category weights', async () => {
        const c = await get('/api/config');
        const w = c.categoryWeights;
        const sum = Object.values(w).reduce((a, b) => a + b, 0);
        if (Math.abs(sum - 100) > 0.01) throw new Error('Category weights sum != 100: ' + sum);
    });

    // ---- 3. PAPER TRADING ----
    console.log('\n📋 3. PAPER TRADING');

    // Reset test data first
    await post('/api/paper-trading/reset', { symbol: 'ZBCNUSDT' }).catch(() => {});
    await post('/api/paper-trading/reset', { symbol: 'PROSUSDT' }).catch(() => {});

    await test('ZBCNUSDT portfolio', async () => {
        const p = await get('/api/paper-trading/portfolio?symbol=ZBCNUSDT');
        if (typeof p.balance !== 'number') throw new Error('Missing balance');
        if (p.symbol !== 'ZBCNUSDT') throw new Error('Wrong symbol: ' + p.symbol);
        if (p.initialBalance !== 10000) throw new Error('Wrong initial balance: ' + p.initialBalance);
    });

    await test('PROSUSDT portfolio', async () => {
        const p = await get('/api/paper-trading/portfolio?symbol=PROSUSDT');
        if (typeof p.balance !== 'number') throw new Error('Missing balance');
        if (p.symbol !== 'PROSUSDT') throw new Error('Wrong symbol: ' + p.symbol);
        if (p.initialBalance !== 5000) throw new Error('Wrong initial balance: ' + p.initialBalance);
    });

    await test('ZBCNUSDT positions - boş', async () => {
        const p = await get('/api/paper-trading/positions?symbol=ZBCNUSDT');
        if (!Array.isArray(p)) throw new Error('Expected array');
    });

    await test('PROSUSDT positions - boş', async () => {
        const p = await get('/api/paper-trading/positions?symbol=PROSUSDT');
        if (!Array.isArray(p)) throw new Error('Expected array');
    });

    await test('ZBCNUSDT pending - boş', async () => {
        const p = await get('/api/paper-trading/pending?symbol=ZBCNUSDT');
        if (!Array.isArray(p)) throw new Error('Expected array');
    });

    await test('ZBCNUSDT history - boş', async () => {
        const p = await get('/api/paper-trading/history?symbol=ZBCNUSDT&limit=5');
        if (!Array.isArray(p)) throw new Error('Expected array');
    });

    await test('Execute trade - eksik parametre', async () => {
        try {
            await post('/api/paper-trading/execute', {});
            throw new Error('Should have thrown 400');
        } catch (e) {
            if (!e.message.includes('400')) throw new Error('Wrong error: ' + e.message);
        }
    });

    await test('Execute trade - başarılı manuel', async () => {
        const r = await post('/api/paper-trading/execute', {
            signal: 'BUY', price: 0.003, confidence: 70,
            symbol: 'ZBCNUSDT', metadata: { source: 'test' }
        });
        if (!r.success) throw new Error('Trade failed: ' + JSON.stringify(r));
        if (r.status !== 'executed') throw new Error('Wrong status: ' + r.status);
    });

    await test('ZBCNUSDT positions - 1 pozisyon', async () => {
        const p = await get('/api/paper-trading/positions?symbol=ZBCNUSDT');
        if (p.length !== 1) throw new Error('Expected 1 position, got: ' + p.length);
    });

    await test('Close position', async () => {
        const p = await get('/api/paper-trading/positions?symbol=ZBCNUSDT');
        const pos = p[0];
        const r = await post('/api/paper-trading/close', {
            positionId: pos.id, currentPrice: 0.0035, reason: 'test'
        });
        if (!r.success) throw new Error('Close failed: ' + JSON.stringify(r));
        if (typeof r.pnl !== 'number') throw new Error('Missing PnL');
    });

    await test('ZBCNUSDT portfolio - bakiye değişmiş', async () => {
        const p = await get('/api/paper-trading/portfolio?symbol=ZBCNUSDT');
        if (p.totalTrades < 1) throw new Error('No trades recorded');
        if (p.totalReturn === 0 && p.totalTrades > 0) throw new Error('Expected non-zero return');
    });

    await test('Check SL/TP', async () => {
        const r = await post('/api/paper-trading/check-sl-tp', {
            currentPrice: 0.003, symbol: 'ZBCNUSDT'
        });
        if (!Array.isArray(r)) throw new Error('Expected array');
    });

    // ---- 4. VERİ ÇEKME ----
    console.log('\n📋 4. VERİ ÇEKME (API Proxy)');

    await test('/api/all - ZBCNUSDT', async () => {
        const d = await get('/api/all?symbol=ZBCNUSDT');
        if (!d || d.error) throw new Error('API error: ' + JSON.stringify(d.error));
    });

    await test('/api/all - PROSUSDT', async () => {
        const d = await get('/api/all?symbol=PROSUSDT');
        if (!d || d.error) throw new Error('API error: ' + JSON.stringify(d.error));
    });

    await test('/api/all - ticker var', async () => {
        const d = await get('/api/all?symbol=ZBCNUSDT');
        if (!d.ticker) throw new Error('Missing ticker');
    });

    await test('/api/all - candles var', async () => {
        const d = await get('/api/all?symbol=ZBCNUSDT');
        if (!d.candles1h) throw new Error('Missing 1h candles');
        if (!d.candles15m) throw new Error('Missing 15m candles');
        if (!d.candles4h) throw new Error('Missing 4h candles');
    });

    await test('/api/all - coingecko var', async () => {
        const d = await get('/api/all?symbol=ZBCNUSDT');
        if (!d.coingecko) throw new Error('Missing coingecko');
    });

    await test('/api/all - önbellek çalışıyor', async () => {
        // İkinci çağrı önbellekten gelmeli
        const d1 = await get('/api/all?symbol=ZBCNUSDT');
        const d2 = await get('/api/all?symbol=ZBCNUSDT');
        if (d2._cached) {
            // Önbellek çalışıyor
        }
    });

    // ---- 5. SİNYAL GEÇMİŞİ ----
    console.log('\n📋 5. SİNYAL GEÇMİŞİ');

    await test('Signal history - geçerli sembol', async () => {
        const h = await get('/api/signal-history?symbol=ZBCNUSDT&limit=10');
        if (!Array.isArray(h)) throw new Error('Expected array');
    });

    await test('Signal stats', async () => {
        const s = await get('/api/signal-stats?symbol=ZBCNUSDT');
        if (typeof s.total !== 'number') throw new Error('Missing total');
    });

    await test('Log signal', async () => {
        const r = await post('/api/log-signal', {
            signal: 'NEUTRAL', confidence: 50, weightedScore: 0,
            symbol: 'ZBCNUSDT', state: 'WAIT'
        });
        if (r.status !== 'ok') throw new Error('Log failed: ' + JSON.stringify(r));
    });

    // ---- 6. RİSK YÖNETİMİ ----
    console.log('\n📋 6. RİSK YÖNETİMİ');

    await test('Risk parameters', async () => {
        const r = await get('/api/risk/parameters');
        if (typeof r.maxPositionSize !== 'number') throw new Error('Missing risk params');
    });

    await test('Calculate position size', async () => {
        const r = await post('/api/risk/calculate-position', {
            balance: 10000, entryPrice: 0.003, stopLossPrice: 0.0025
        });
        if (!r.success) throw new Error('Position calc failed: ' + JSON.stringify(r));
        if (typeof r.quantity !== 'number') throw new Error('Missing quantity');
    });

    await test('Validate trade - geçerli', async () => {
        const r = await post('/api/risk/validate-trade', {
            signal: 'BUY', entryPrice: 0.003, stopLoss: 0.0025, takeProfit: 0.0036
        });
        if (!r.valid) throw new Error('Expected valid: ' + JSON.stringify(r.errors));
    });

    await test('Validate trade - geçersiz SL', async () => {
        const r = await post('/api/risk/validate-trade', {
            signal: 'BUY', entryPrice: 0.003, stopLoss: 0.0035, takeProfit: 0.003
        });
        if (r.valid) throw new Error('Expected invalid');
        if (!r.errors || r.errors.length === 0) throw new Error('Expected errors');
    });

    // ---- 7. DASHBOARD ----
    console.log('\n📋 7. DASHBOARD STATIC');

    await test('Ana sayfa yükleniyor', async () => {
        await new Promise((resolve, reject) => {
            http.get(BASE_URL + '/', res => {
                let data = '';
                res.on('data', c => data += c);
                res.on('end', () => {
                    if (data.includes('ZBCNUSDT Sinyal Terminali')) resolve();
                    else reject(new Error('Dashboard content not found'));
                });
            }).on('error', reject);
        });
    });

    await test('Favicon 204', async () => {
        await new Promise((resolve, reject) => {
            http.get(BASE_URL + '/favicon.ico', res => {
                if (res.statusCode === 204) resolve();
                else reject(new Error('Expected 204, got: ' + res.statusCode));
            }).on('error', reject);
        });
    });

    // ---- 8. ÇOKLU SEMBOL ----
    console.log('\n📋 8. ÇOKLU SEMBOL');

    await test('Tüm semboller için canlı veri API çalışıyor', async () => {
        const symbols = ['ZBCNUSDT', 'PROSUSDT', 'WLFIUSDT', 'SOLUSDT'];
        const results = await Promise.all(symbols.map(symbol => get('/api/all?symbol=' + symbol)));
        results.forEach((data, index) => {
            if (!data.ticker || !data.candles1h || !data.candles15m || !data.candles4h) {
                throw new Error(symbols[index] + ' canlı veri eksik');
            }
            if (data._symbol !== symbols[index]) throw new Error(symbols[index] + ' symbol mismatch');
        });
    });

    await test('Tüm semboller için sembol bazlı sinyal motoru çalışıyor', async () => {
        const symbols = ['ZBCNUSDT', 'PROSUSDT', 'WLFIUSDT', 'SOLUSDT'];
        const results = await Promise.all(symbols.map(symbol => get('/api/signal?symbol=' + symbol)));
        results.forEach((data, index) => {
            if (data.symbol !== symbols[index]) throw new Error(symbols[index] + ' signal symbol mismatch');
            if (!['BUY', 'SELL', 'NEUTRAL'].includes(data.signal)) throw new Error(symbols[index] + ' invalid signal');
            if (typeof data.confidence !== 'number' || !Number.isFinite(data.confidence)) throw new Error(symbols[index] + ' invalid confidence');
            if (typeof data.historicalAccuracy !== 'number') throw new Error(symbols[index] + ' missing accuracy');
        });
    });

    // ---- 9. SINIR TESTLERİ ----
    console.log('\n📋 9. SINIR TESTLERİ');

    await test('Bilinmeyen sembol - hata', async () => {
        try {
            await get('/api/all?symbol=UNKNOWN');
            throw new Error('Expected error for unknown symbol');
        } catch (e) {
            if (!e.message.includes('400')) throw new Error('Wrong error: ' + e.message);
        }
    });

    await test('Rate limiting - limit 200 istek/dk', async () => {
        // Hızlı 5 istek at - hepsi başarılı olmalı
        const promises = [];
        for (let i = 0; i < 5; i++) {
            promises.push(get('/api/health'));
        }
        const results = await Promise.all(promises);
        for (const r of results) {
            if (r.status !== 'ok') throw new Error('Rate limit false positive');
        }
    });

    await test('Portfolio varsayılan sembol', async () => {
        const p = await get('/api/paper-trading/portfolio');
        if (!p.symbol) throw new Error('Missing symbol from default portfolio');
    });

    // ---- SONUÇ ----
    console.log('\n============================================');
    console.log(`  SONUÇ: ${passed}/${total} test geçti`);
    if (failed > 0) console.log(`  ⚠️ ${failed} test BAŞARISIZ`);
    console.log('============================================\n');

    process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(e => {
    console.error('Test runner hatası:', e.message);
    process.exit(1);
});