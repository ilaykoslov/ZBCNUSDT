const http = require('http');
const fs = require('fs');

function fetchJson(url) {
    return new Promise((resolve, reject) => {
        const u = new URL(url);
        http.get({ hostname: u.hostname, port: u.port || 80, path: u.pathname + u.search }, (res) => {
            let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(JSON.parse(d)));
        }).on('error', reject);
    });
}

const html = fs.readFileSync('dashboard.html', 'utf8');
const start = html.lastIndexOf('<script>');
const end = html.lastIndexOf('</script>');
const script = html.substring(start + 8, end);

// Minimal DOM mock (CommonJS, no strict mode issues)
global.document = {
    getElementById: () => ({ textContent: '', style: {}, className: '', innerHTML: '' }),
    addEventListener: () => {},
    hidden: false
};
global.window = { addEventListener: () => {}, clearInterval: () => {}, setInterval: () => 123 };
global.fetch = async () => ({ ok: true, json: async () => ({}) });
global.clearInterval = () => {};
global.setInterval = () => 123;

// Use indirect eval to run in global scope (not strict)
const indirectEval = (0, eval);
indirectEval(script);

console.log('Functions loaded');
console.log('parseKuCoinCandles:', typeof parseKuCoinCandles);
console.log('analyzeTimeframe:', typeof analyzeTimeframe);
console.log('calculateBollingerBands:', typeof calculateBollingerBands);

async function test() {
    const json = await fetchJson('http://localhost:3456/api/all');

    const c1h = parseKuCoinCandles(json.candles1h.data);
    const c15m = json.candles15m ? parseKuCoinCandles(json.candles15m.data) : [];
    const c4h = json.candles4h ? parseKuCoinCandles(json.candles4h.data) : [];

    console.log(`\nData: 1h=${c1h.length}, 15m=${c15m.length}, 4h=${c4h.length}`);
    console.log(`Price: ${c1h[c1h.length - 1].close}`);

    // Test indicators
    const closes = c1h.map(c => c.close);
    const rsiArr = calculateRSI(closes, 14);
    console.log(`RSI: ${rsiArr[rsiArr.length - 1]?.toFixed(2)}`);

    const macd = calculateMACD(closes);
    console.log(`MACD: ${macd.macdLine[macd.macdLine.length - 1]}`);
    console.log(`MACD Signal: ${macd.signalLine[macd.signalLine.length - 1]}`);

    const bb = calculateBollingerBands(closes, 20, 2);
    console.log(`BB %B: ${bb.percentB[bb.percentB.length - 1]?.toFixed(4)}`);

    const adxResult = calculateADX(c1h, 14);
    console.log(`ADX: ${adxResult.adx[adxResult.adx.length - 1]?.toFixed(1)}`);

    const stochRsi = calculateStochRSI(closes);
    console.log(`StochRSI K: ${stochRsi.k[stochRsi.k.length - 1]?.toFixed(1)}`);

    const obvArr = calculateOBV(c1h);
    const obl = obvArr[obvArr.length - 1];
    const obp = obvArr[obvArr.length - 2];
    console.log(`OBV slope: ${obl && obp ? ((obl - obp) / Math.abs(obp || 1) * 100).toFixed(4) : 'N/A'}`);

    const fullRsi = calculateRSI(closes);
    const div = detectDivergence(closes, fullRsi, 20);
    console.log(`Divergence: ${div.type}`);

    const sr = findSupportResistance(c1h, 3);
    console.log(`Support: ${sr.support.map(s => s.toFixed(8)).join(', ')}`);
    console.log(`Resistance: ${sr.resistance.map(r => r.toFixed(8)).join(', ')}`);

    // Full analysis
    console.log('\n=== FULL ANALYSIS ===');
    const r1h = analyzeTimeframe(c1h, '1h');
    console.log(`Signal: ${r1h.signal}, Score: ${r1h.weightedScore?.toFixed(2)}, Conf: ${r1h.confidence?.toFixed(1)}`);
    console.log('Categories:');
    for (const [k, v] of Object.entries(r1h.details)) {
        console.log(`  ${k}: ${v.score} (${v.detail})`);
    }

    if (c15m.length >= 30) {
        const r15m = analyzeTimeframe(c15m, '15m');
        console.log(`\n15m: ${r15m.signal} (${r15m.weightedScore?.toFixed(1)})`);
    }
    if (c4h.length >= 30) {
        const r4h = analyzeTimeframe(c4h, '4h');
        console.log(`4h: ${r4h.signal} (${r4h.weightedScore?.toFixed(1)})`);
    }
}

test().catch(e => {
    console.error('\nERROR:', e.message, e.stack?.substring(0, 300));
    process.exitCode = 1;
});
