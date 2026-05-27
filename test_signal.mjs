import http from 'http';
import fs from 'fs';

function fetchJson(url) {
    return new Promise((resolve, reject) => {
        const u = new URL(url);
        const opts = { hostname: u.hostname, port: u.port || 80, path: u.pathname + u.search, method: 'GET', headers: { 'User-Agent': 'Mozilla/5.0' } };
        const req = http.request(opts, (res) => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>resolve(JSON.parse(d))); });
        req.on('error', reject); req.end();
    });
}

const html = fs.readFileSync('dashboard.html', 'utf8');

// Find the LAST <script> tag
const lastScriptStart = html.lastIndexOf('<script>');
const lastScriptEnd = html.lastIndexOf('</script>');
let scriptContent = html.substring(lastScriptStart + 8, lastScriptEnd);

// Create comprehensive DOM mock
const createElementMock = () => ({
    textContent: '',
    innerHTML: '',
    style: {},
    className: '',
    classList: { add: () => {} },
    strokeDasharray: '',
    strokeDashoffset: '',
    stroke: '',
    width: '',
    background: '',
    left: '',
    color: '',
    href: '',
    target: '',
    onclick: null,
    addEventListener: () => {},
    appendChild: () => {},
    setAttribute: () => {},
    map: () => [],
    filter: () => [],
    join: () => '',
    slice: () => []
});

const mockDoc = {
    getElementById: () => createElementMock(),
    querySelector: () => null,
    createElement: () => createElementMock(),
    body: { appendChild: () => {} },
    documentElement: { style: {} },
    addEventListener: () => {},
    visibilityState: 'visible',
    hidden: false
};

global.document = mockDoc;
global.window = {
    addEventListener: () => {},
    removeEventListener: () => {},
    setTimeout: () => {},
    clearInterval: () => {},
    setInterval: () => 123,
    innerWidth: 1024,
    innerHeight: 768,
    location: { href: '', reload: () => {} }
};
global.console = console;
global.parseInt = parseInt;
global.parseFloat = parseFloat;
global.isNaN = isNaN;
global.Math = Math;
global.JSON = JSON;
global.Error = Error;
global.Array = Array;
global.fetch = () => Promise.resolve({ json: async () => Promise.resolve({}), ok: true });
global.clearInterval = () => {};
global.setInterval = () => 123;
global.document.addEventListener = () => {};
global.document.hidden = false;

// Evaluate the ENTIRE script without stripping
try {
    eval(scriptContent);
    console.log('All functions loaded OK\n');
} catch (e) {
    console.log('Eval error (may be benign):', e.message.substring(0, 120));
    // Check if parseKuCoinCandles exists despite the error
    try {
        if (typeof parseKuCoinCandles === 'function') {
            console.log('Key functions still available despite error');
        }
    } catch(e2) {
        console.log('Functions not available:', e2.message);
    }
}

// Test with real data
async function test() {
    const json = await fetchJson('http://localhost:3456/api/all');
    
    const c1h = parseKuCoinCandles(json.candles1h.data);
    const c15m = json.candles15m ? parseKuCoinCandles(json.candles15m.data) : [];
    const c4h = json.candles4h ? parseKuCoinCandles(json.candles4h.data) : [];
    
    console.log(`Data loaded: 1h=${c1h.length}, 15m=${c15m.length}, 4h=${c4h.length}`);
    console.log(`Current price: ${c1h[c1h.length-1].close}\n`);
    
    // Test individual indicators first
    const closes = c1h.map(c => c.close);
    console.log('--- Individual Indicator Tests ---');
    
    const rsiArr = calculateRSI(closes, 14);
    console.log('RSI last:', rsiArr[rsiArr.length-1]?.toFixed(2));
    
    const sma7 = calculateSMA(closes, 7);
    console.log('SMA7 last:', sma7[sma7.length-1]);
    
    const sma25 = calculateSMA(closes, 25);
    console.log('SMA25 last:', sma25[sma25.length-1]);
    
    const macd = calculateMACD(closes);
    console.log('MACD line:', macd.macdLine[macd.macdLine.length-1]);
    console.log('MACD signal:', macd.signalLine[macd.signalLine.length-1]);
    console.log('MACD hist:', macd.histogram[macd.histogram.length-1]);
    
    const bb = calculateBollingerBands(closes, 20, 2);
    console.log('BB %B:', bb.percentB[bb.percentB.length-1]?.toFixed(4));
    console.log('BB bandwidth:', bb.bandwidth[bb.bandwidth.length-1]);
    
    const fullRsi = calculateRSI(closes);
    const divergence = detectDivergence(closes, fullRsi, 20);
    console.log('Divergence:', divergence.type);
    
    const adxResult = calculateADX(c1h, 14);
    const lastAdx = adxResult.adx[adxResult.adx.length-1];
    const lastPdi = adxResult.pdi[adxResult.pdi.length-1];
    const lastMdi = adxResult.mdi[adxResult.mdi.length-1];
    console.log('ADX:', lastAdx?.toFixed(1), '+DI:', lastPdi?.toFixed(1), '-DI:', lastMdi?.toFixed(1));
    
    const obvArr = calculateOBV(c1h);
    const obvLast = obvArr[obvArr.length-1];
    const obvPrev = obvArr[obvArr.length-2];
    console.log('OBV slope:', obvLast && obvPrev ? ((obvLast-obvPrev)/Math.abs(obvPrev||1)*100).toFixed(2) : 'N/A');
    
    const stochRsi = calculateStochRSI(closes);
    console.log('StochRSI K:', stochRsi.k[stochRsi.k.length-1]?.toFixed(1));
    console.log('StochRSI D:', stochRsi.d[stochRsi.d.length-1]?.toFixed(1));
    
    const sr = findSupportResistance(c1h, 3);
    console.log('Support:', sr.support.map(s => s.toFixed(8)));
    console.log('Resistance:', sr.resistance.map(r => r.toFixed(8)));
    
    // Now test the full analysis
    console.log('\n--- Full Analysis Test ---');
    const r1h = analyzeTimeframe(c1h, '1h');
    
    console.log('\n=== 1h ANALYSIS ===');
    console.log('Signal:', r1h.signal);
    console.log('Confidence:', r1h.confidence?.toFixed(1));
    console.log('Weighted Score:', r1h.weightedScore?.toFixed(2));
    console.log('\nCategory Scores:');
    for (const [cat, data] of Object.entries(r1h.details)) {
        console.log(`  ${cat}: ${data.score} (${data.detail})`);
    }
    console.log('\nKey Indicators:');
    const ind = r1h.indicators;
    console.log(`  RSI: ${ind.rsi?.toFixed(1)}`);
    console.log(`  SMA7: ${ind.sma7} (slope: ${ind.sma7Slope?.toFixed(4)})`);
    console.log(`  SMA25: ${ind.sma25} (slope: ${ind.sma25Slope?.toFixed(4)})`);
    console.log(`  ADX: ${ind.adx?.toFixed(1)}`);
    console.log(`  BB %B: ${ind.bbPercentB?.toFixed(3)}`);
    console.log(`  Divergence: ${ind.divergence}`);
    console.log(`  OBV Slope: ${ind.obvSlope?.toFixed(2)}`);
    
    if (c15m.length >= 30) {
        const r15m = analyzeTimeframe(c15m, '15m');
        console.log(`\n=== 15m: ${r15m.signal} (score: ${r15m.weightedScore?.toFixed(1)}, conf: ${r15m.confidence?.toFixed(1)})`);
    }
    if (c4h.length >= 30) {
        const r4h = analyzeTimeframe(c4h, '4h');
        console.log(`=== 4h: ${r4h.signal} (score: ${r4h.weightedScore?.toFixed(1)}, conf: ${r4h.confidence?.toFixed(1)})`);
    }
}

test().catch(e => {
    console.error('\nTEST ERROR:', e.message);
    console.error(e.stack?.substring(0, 500));
});
