/**
 * Backend Signal Engine (Source of Truth)
 * - candlesByTf: { '1h': [...], '15m': [...], '4h': [...] }
 * - returns payload compatible with tests/test_schema.json
 */

const { analyzeConfluence, detectMarketRegime, getRegimeWeights, calculateTradeGrade } = require('./confluence');

// ---------- Math helpers ----------
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const last = (arr) => (arr && arr.length ? arr[arr.length - 1] : null);
const prev = (arr) => (arr && arr.length > 1 ? arr[arr.length - 2] : null);

function sma(values, period) {
    if (!values || values.length < period) return Array(values ? values.length : 0).fill(null);
    const out = Array(values.length).fill(null);
    let sum = 0;
    for (let i = 0; i < values.length; i++) {
        sum += values[i];
        if (i >= period) sum -= values[i - period];
        if (i >= period - 1) out[i] = sum / period;
    }
    return out;
}

function ema(values, period) {
    const out = Array(values.length).fill(null);
    const k = 2 / (period + 1);
    let prevEma = null;
    for (let i = 0; i < values.length; i++) {
        if (values[i] == null) continue;
        if (prevEma == null) {
            // seed with SMA
            if (i >= period - 1) {
                const seed = values.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period;
                prevEma = seed;
                out[i] = seed;
            }
        } else {
            prevEma = values[i] * k + prevEma * (1 - k);
            out[i] = prevEma;
        }
    }
    return out;
}

function rsi(prices, period = 14) {
    if (!prices || prices.length < period + 1) return Array(prices ? prices.length : 0).fill(null);

    const changes = [];
    for (let i = 1; i < prices.length; i++) changes.push(prices[i] - prices[i - 1]);

    const gains = changes.map(c => (c > 0 ? c : 0));
    const losses = changes.map(c => (c < 0 ? -c : 0));

    const out = Array(prices.length).fill(null);
    let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
    let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

    // first RSI value at index = period
    const firstIdx = period;
    if (avgLoss === 0) out[firstIdx] = 100;
    else {
        const rs = avgGain / avgLoss;
        out[firstIdx] = 100 - 100 / (1 + rs);
    }

    for (let i = period + 1; i < prices.length; i++) {
        const changeIdx = i - 1;
        avgGain = (avgGain * (period - 1) + gains[changeIdx]) / period;
        avgLoss = (avgLoss * (period - 1) + losses[changeIdx]) / period;

        if (avgLoss === 0) out[i] = 100;
        else {
            const rs = avgGain / avgLoss;
            out[i] = 100 - 100 / (1 + rs);
        }
    }
    return out;
}

function macd(prices, fast = 12, slow = 26, signalPeriod = 9) {
    const emaFast = ema(prices, fast);
    const emaSlow = ema(prices, slow);
    const macdLine = prices.map((_, i) => {
        if (emaFast[i] == null || emaSlow[i] == null) return null;
        return emaFast[i] - emaSlow[i];
    });

    // EMA over macd line (skip nulls by treating them as missing)
    const cleaned = macdLine.map(v => (v == null ? null : v));
    const signalLine = ema(cleaned.map(v => (v == null ? 0 : v)), signalPeriod).map((v, i) => {
        if (cleaned[i] == null) return null;
        // ema() seeds later; still return null if macdLine[i] missing
        return macdLine[i] == null ? null : v;
    });

    const histogram = macdLine.map((v, i) => {
        if (v == null || signalLine[i] == null) return null;
        return v - signalLine[i];
    });

    return { macdLine, signalLine, histogram };
}

function bollinger(prices, period = 20, stdDev = 2) {
    const mid = sma(prices, period);
    const upper = Array(prices.length).fill(null);
    const lower = Array(prices.length).fill(null);
    const bandwidth = Array(prices.length).fill(null);
    const percentB = Array(prices.length).fill(null);

    for (let i = 0; i < prices.length; i++) {
        if (mid[i] == null) continue;
        let sumSq = 0;
        const start = i - period + 1;
        for (let j = start; j <= i; j++) sumSq += (prices[j] - mid[i]) ** 2;
        const sd = Math.sqrt(sumSq / period);

        upper[i] = mid[i] + stdDev * sd;
        lower[i] = mid[i] - stdDev * sd;
        bandwidth[i] = mid[i] !== 0 ? (upper[i] - lower[i]) / mid[i] : null;
        percentB[i] = (upper[i] - lower[i]) !== 0 ? (prices[i] - lower[i]) / (upper[i] - lower[i]) : null;
    }

    return { upper, lower, middle: mid, bandwidth, percentB };
}

function atr(candles, period = 14) {
    if (!candles || candles.length < period + 1) return Array(candles ? candles.length : 0).fill(null);

    const tr = [];
    for (let i = 0; i < candles.length; i++) {
        if (i === 0) {
            tr.push(candles[i].high - candles[i].low);
            continue;
        }
        const hl = candles[i].high - candles[i].low;
        const hc = Math.abs(candles[i].high - candles[i - 1].close);
        const lc = Math.abs(candles[i].low - candles[i - 1].close);
        tr.push(Math.max(hl, hc, lc));
    }

    const out = Array(candles.length).fill(null);
    let sum = tr.slice(1, period + 1).reduce((a, b) => a + b, 0) / period;
    out[period] = sum;

    for (let i = period + 1; i < tr.length; i++) {
        sum = (sum * (period - 1) + tr[i]) / period;
        out[i] = sum;
    }
    return out;
}

function adx(candles, period = 14) {
    const len = candles.length;
    if (len < period * 2) {
        return { adx: Array(len).fill(null), pdi: Array(len).fill(null), mdi: Array(len).fill(null) };
    }

    const tr = [];
    const plusDM = [];
    const minusDM = [];
    for (let i = 0; i < len; i++) {
        if (i === 0) {
            tr.push(0); plusDM.push(0); minusDM.push(0);
            continue;
        }
        const upMove = candles[i].high - candles[i - 1].high;
        const downMove = candles[i - 1].low - candles[i].low;

        const hl = candles[i].high - candles[i].low;
        const hc = Math.abs(candles[i].high - candles[i - 1].close);
        const lc = Math.abs(candles[i].low - candles[i - 1].close);
        tr.push(Math.max(hl, hc, lc));

        plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
        minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
    }

    const atrSmooth = Array(len).fill(null);
    const pdi = Array(len).fill(null);
    const mdi = Array(len).fill(null);

    let trSum = tr.slice(1, period + 1).reduce((a, b) => a + b, 0) / period;
    let pdmSum = plusDM.slice(1, period + 1).reduce((a, b) => a + b, 0) / period;
    let mdmSum = minusDM.slice(1, period + 1).reduce((a, b) => a + b, 0) / period;

    atrSmooth[period] = trSum;
    pdi[period] = trSum ? (pdmSum / trSum) * 100 : 0;
    mdi[period] = trSum ? (mdmSum / trSum) * 100 : 0;

    for (let i = period + 1; i < len; i++) {
        trSum = (trSum * (period - 1) + tr[i]) / period;
        pdmSum = (pdmSum * (period - 1) + plusDM[i]) / period;
        mdmSum = (mdmSum * (period - 1) + minusDM[i]) / period;
        atrSmooth[i] = trSum;
        pdi[i] = trSum ? (pdmSum / trSum) * 100 : 0;
        mdi[i] = trSum ? (mdmSum / trSum) * 100 : 0;
    }

    const dx = Array(len).fill(null);
    for (let i = 0; i < len; i++) {
        const sum = (pdi[i] ?? 0) + (mdi[i] ?? 0);
        if (!sum) dx[i] = 0;
        else dx[i] = Math.abs((pdi[i] - mdi[i]) / sum) * 100;
    }

    const adxOut = Array(len).fill(null);
    // First ADX at index ~ 2*period
    const start = period * 2;
    if (start < len) {
        const window = dx.slice(start - period, start).filter(v => v != null);
        if (window.length === period) {
            adxOut[start] = window.reduce((a, b) => a + b, 0) / period;
            let prev = adxOut[start];
            for (let i = start + 1; i < len; i++) {
                if (dx[i] == null) continue;
                prev = (prev * (period - 1) + dx[i]) / period;
                adxOut[i] = prev;
            }
        }
    }

    return { adx: adxOut, pdi, mdi };
}

function obv(candles) {
    if (!candles || candles.length < 2) return Array(candles ? candles.length : 0).fill(null);
    const out = Array(candles.length).fill(0);
    for (let i = 1; i < candles.length; i++) {
        if (candles[i].close > candles[i - 1].close) out[i] = out[i - 1] + candles[i].volume;
        else if (candles[i].close < candles[i - 1].close) out[i] = out[i - 1] - candles[i].volume;
        else out[i] = out[i - 1];
    }
    return out;
}

function slope(values, lookback = 3) {
    if (!values || values.length < lookback + 1) return 0;
    const curr = values[values.length - 1];
    const prevV = values[values.length - 1 - lookback];
    if (curr == null || prevV == null || prevV === 0) return 0;
    return ((curr - prevV) / prevV) * 100;
}

// ---------- Import custom indicator modules ----------
const {
    calculateIchimoku, getIchimokuSignal
} = require('../indicators/ichimoku');

const {
    calculateWilliamsR, getWilliamsRSignal
} = require('../indicators/williamsR');

const {
    calculateCCI, getCciSignal
} = require('../indicators/cci');

const { calculateVWAP, getVwapSignal } = require('../indicators/vwap');
const { calculateVolumeProfile, getVolumeProfileSignal } = require('../indicators/volumeProfile');
const { calculateKeltnerChannels, getKeltnerSignal } = require('../indicators/keltner');
const { calculateSupertrend, getSupertrendSignal } = require('../indicators/supertrend');

// ---------- Timeframe analysis ----------
function analyzeTimeframeTf(candles, tfName, appConfig) {
    if (!candles || candles.length < 30) return null;

    const closes = candles.map(c => c.close);
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);
    const volumes = candles.map(c => c.volume);
    const currentPrice = last(closes);

    // Trend
    const sma7Arr = sma(closes, 7);
    const sma25Arr = sma(closes, 25);
    const sma99Arr = sma(closes, 99);

    const sma7v = last(sma7Arr);
    const sma25v = last(sma25Arr);
    const sma99v = last(sma99Arr);

    const sma7Slope = slope(sma7Arr, 3);
    const sma25Slope = slope(sma25Arr, 3);

    // Momentum
    const rsiArr = rsi(closes, 14);
    const rsiVal = last(rsiArr);
    const rsiPrev = prev(rsiArr);

    const macdRes = macd(closes, 12, 26, 9);
    const macdV = last(macdRes.macdLine);
    const signalV = last(macdRes.signalLine);
    const histV = last(macdRes.histogram);
    const histPrev = prev(macdRes.histogram);

    // Volatility
    const bb = bollinger(closes, 20, 2);
    const bbUpper = last(bb.upper);
    const bbLower = last(bb.lower);
    const bbMiddle = last(bb.middle);
    const bbBandwidth = last(bb.bandwidth);
    const bbPercentB = last(bb.percentB);

    const atrArr = atr(candles, 14);
    const atrVal = last(atrArr);
    const atrPct = atrVal && currentPrice ? (atrVal / currentPrice) * 100 : 0;

    const keltner = calculateKeltnerChannels(candles);

    // Volume
    const obvArr = obv(candles);
    const recentObv = obvArr.slice(-5).filter(v => v != null);
    let obvSlope = 0;
    if (recentObv.length >= 2) {
        const recentChange = recentObv[recentObv.length - 1] - recentObv[0];
        const allChanges = [];
        for (let i = 5; i < obvArr.length; i++) {
            if (obvArr[i] != null && obvArr[i - 5] != null) allChanges.push(Math.abs(obvArr[i] - obvArr[i - 5]));
        }
        const meanChange = allChanges.length ? allChanges.reduce((a, b) => a + b, 0) / allChanges.length : 1;
        obvSlope = meanChange > 0 ? recentChange / meanChange : 0;
    }

    const vwapArr = calculateVWAP(candles);
    const vwapVal = last(vwapArr);

    const volProfile = calculateVolumeProfile(candles, appConfig?.volumeProfileBins || 50);
    const vpSignal = getVolumeProfileSignal(volProfile, currentPrice);

    const wrArr = calculateWilliamsR(candles, 14);
    const wrVal = last(wrArr);

    const cciArr = calculateCCI(candles, 20);
    const cciVal = last(cciArr);

    const ich = calculateIchimoku(candles);
    const tenkan = last(ich.tenkan);
    const kijun = last(ich.kijun);
    const senkouA = last(ich.senkouA);
    const senkouB = last(ich.senkouB);

    const supertrendRes = calculateSupertrend(candles);
    const supertrendVal = last(supertrendRes.supertrend);
    const supertrendDir = last(supertrendRes.direction);

    const adxRes = adx(candles, 14);
    const adxVal = last(adxRes.adx);
    const pdi = last(adxRes.pdi);
    const mdi = last(adxRes.mdi);

    // ---------- Score categories (port from dashboard scoring, simplified) ----------
    const trendDetails = [];
    let trendScore = 0;

    if (sma7v != null) {
        trendScore += currentPrice > sma7v ? 12 : -12;
        trendDetails.push(currentPrice > sma7v ? 'Fiyat>SMA7' : 'Fiyat<SMA7');
    }
    if (sma25v != null) {
        trendScore += currentPrice > sma25v ? 10 : -10;
        trendDetails.push(currentPrice > sma25v ? 'Fiyat>SMA25' : 'Fiyat<SMA25');
    }
    if (sma99v != null) {
        trendScore += currentPrice > sma99v ? 8 : -8;
        trendDetails.push(currentPrice > sma99v ? 'Fiyat>SMA99' : 'Fiyat<SMA99');
    }

    if (sma7Slope > 0.1) { trendScore += 15; trendDetails.push('SMA7↑'); }
    else if (sma7Slope < -0.1) { trendScore -= 15; trendDetails.push('SMA7↓'); }

    if (sma25Slope > 0.1) { trendScore += 10; trendDetails.push('SMA25↑'); }
    else if (sma25Slope < -0.1) { trendScore -= 10; trendDetails.push('SMA25↓'); }

    if (sma7v != null && sma25v != null && sma99v != null) {
        if (sma7v > sma25v && sma25v > sma99v) { trendScore += 15; trendDetails.push('BullishOrder'); }
        else if (sma7v < sma25v && sma25v < sma99v) { trendScore -= 15; trendDetails.push('BearishOrder'); }
    }

    if (adxVal != null) {
        if (adxVal >= 25 && pdi > mdi) { trendScore += 20; trendDetails.push(`StrongUp(${adxVal.toFixed(0)})`); }
        else if (adxVal >= 25 && mdi > pdi) { trendScore -= 20; trendDetails.push(`StrongDown(${adxVal.toFixed(0)})`); }
        else if (adxVal >= 20) { trendScore += 5; trendDetails.push(`Trending(${adxVal.toFixed(0)})`); }
    }

    if (tenkan != null && kijun != null) {
        trendScore += tenkan > kijun ? 10 : -10;
        trendDetails.push(tenkan > kijun ? 'Tenkan>Kijun' : 'Tenkan<Kijun');
    }
    if (senkouA != null && senkouB != null) {
        const cloudTop = Math.max(senkouA, senkouB);
        const cloudBottom = Math.min(senkouA, senkouB);
        if (currentPrice > cloudTop) { trendScore += 12; trendDetails.push('Fiyat>Bulut'); }
        else if (currentPrice < cloudBottom) { trendScore -= 12; trendDetails.push('Fiyat<Bulut'); }
    }

    if (supertrendDir != null) {
        trendScore += supertrendDir === 1 ? 15 : -15;
        trendDetails.push(supertrendDir === 1 ? 'Supertrend↑' : 'Supertrend↓');
    }

    const trendFinal = clamp(trendScore, -100, 100);

    // Momentum score
    let momentumScore = 0;
    const momentumDetails = [];

    if (rsiVal != null) {
        if (rsiVal > 70) { momentumScore -= 15; momentumDetails.push(`RSI${rsiVal.toFixed(0)} Overbought`); }
        else if (rsiVal < 30) { momentumScore += 15; momentumDetails.push(`RSI${rsiVal.toFixed(0)} Oversold`); }
        else if (rsiVal > 60) { momentumScore += 10; momentumDetails.push(`RSI${rsiVal.toFixed(0)} Bull`); }
        else if (rsiVal < 40) { momentumScore -= 10; momentumDetails.push(`RSI${rsiVal.toFixed(0)} Bear`); }

        if (rsiPrev != null) momentumScore += rsiVal > rsiPrev ? 8 : -8;
    }

    if (macdV != null && signalV != null) {
        momentumScore += macdV > signalV ? 15 : -15;
        if (histV != null && histPrev != null && histV > 0 && histV > histPrev) momentumScore += 10;
        if (histV != null && histPrev != null && histV < 0 && histV < histPrev) momentumScore -= 10;
    }

    if (wrVal != null) {
        if (wrVal < -80) { momentumScore += 10; momentumDetails.push('WR-Oversold'); }
        else if (wrVal > -20) { momentumScore -= 10; momentumDetails.push('WR-Overbought'); }
    }

    if (cciVal != null) {
        if (cciVal < -100) { momentumScore += 10; momentumDetails.push('CCI-Oversold'); }
        else if (cciVal > 100) { momentumScore -= 10; momentumDetails.push('CCI-Overbought'); }
        momentumScore += cciVal > 0 ? 5 : -5;
    }

    const momentumFinal = clamp(momentumScore, -100, 100);

    // Volatility score
    let volatilityScore = 0;
    const volatilityDetails = [];

    if (bbPercentB != null) {
        if (bbPercentB > 1.0) { volatilityScore -= 15; volatilityDetails.push('BB>Upper'); }
        else if (bbPercentB < 0) { volatilityScore += 15; volatilityDetails.push('BB<Lower'); }
        else if (bbPercentB > 0.8) { volatilityScore -= 8; volatilityDetails.push('BBUpper'); }
        else if (bbPercentB < 0.2) { volatilityScore += 8; volatilityDetails.push('BBLower'); }
        else volatilityScore += 5;
    }
    if (bbBandwidth != null) {
        const histBandwidths = bb.bandwidth.filter(v => v != null);
        if (histBandwidths.length) {
            const avg = histBandwidths.reduce((a, b) => a + b, 0) / histBandwidths.length;
            if (bbBandwidth < avg * 0.7) { volatilityScore += 15; volatilityDetails.push('Squeeze'); }
        }
    }
    if (atrPct > 5) { volatilityScore += 5; volatilityDetails.push(`HighVol(${atrPct.toFixed(1)}%)`); }

    const kcUpper = last(keltner.upper);
    const kcLower = last(keltner.lower);
    if (kcUpper != null && kcLower != null) {
        if (currentPrice > kcUpper) { volatilityScore -= 10; volatilityDetails.push('KC>Upper'); }
        else if (currentPrice < kcLower) { volatilityScore += 10; volatilityDetails.push('KC<Lower'); }
    }

    const volatilityFinal = clamp(volatilityScore, -100, 100);

    // Volume score
    let volumeScore = 0;
    const volumeDetails = [];

    if (obvSlope > 1.0) { volumeScore += 15; volumeDetails.push('OBV↑'); }
    else if (obvSlope > 0.2) { volumeScore += 8; volumeDetails.push('OBV↑'); }
    else if (obvSlope < -1.0) { volumeScore -= 15; volumeDetails.push('OBV↓'); }
    else if (obvSlope < -0.2) { volumeScore -= 8; volumeDetails.push('OBV↓'); }
    else { volumeScore += 5; volumeDetails.push('OBVFlat'); }

    if (vwapVal != null) {
        volumeScore += currentPrice > vwapVal ? 12 : -12;
        volumeDetails.push(currentPrice > vwapVal ? 'Fiyat>VWAP' : 'Fiyat<VWAP');
    }

    // VolumeProfile tilt
    if (vpSignal && vpSignal.signal !== 'NEUTRAL') {
        volumeScore += vpSignal.signal === 'BUY' ? Math.min(12, vpSignal.confidence / 10) : -Math.min(12, vpSignal.confidence / 10);
        volumeDetails.push(`PVP:${vpSignal.signal}`);
    }

    const volumeFinal = clamp(volumeScore, -100, 100);

    // Structure score: divergence/pivots simplified (use CCI divergence proxy + support/resistance proximity not computed)
    let structureScore = 0;
    const structureDetails = [];
    if (cciVal != null) {
        if (cciVal > 100) { structureScore -= 10; structureDetails.push('CCI overbought'); }
        else if (cciVal < -100) { structureScore += 10; structureDetails.push('CCI oversold'); }
    }

    // Divergence proxy: RSI extreme vs price slope
    const rsiSlope = slope(rsiArr.filter(v => v != null), 3);
    if (rsiVal != null && rsiSlope !== 0) {
        // no strong mapping; just small adjustment
        structureScore += rsiSlope > 0 ? 5 : -5;
    }

    const structureFinal = clamp(structureScore, -100, 100);

    // Regime
    const smaSlope5 = slope(sma(closes, 5), 2);
    const regime = detectMarketRegime(adxVal, bbBandwidth, atrPct, sma7Slope, smaSlope5);

    // Regime weights
    const baseWeights = appConfig?.categoryWeights || { trend: 30, momentum: 25, volatility: 15, volume: 15, structure: 15 };
    const w = getRegimeWeights(regime, baseWeights);

    const weightedScore =
        (trendFinal * w.trend +
            momentumFinal * w.momentum +
            volatilityFinal * w.volatility +
            volumeFinal * w.volume +
            structureFinal * w.structure) / 100;

    // Trade grade
    const grade = calculateTradeGrade(weightedScore, appConfig?.confidence?.baseNeutral ? appConfig.confidence.baseNeutral : 55, regime, adxVal);

    // TF signal from threshold
    const buyThreshold = appConfig?.signalThresholds?.buy ?? 12;
    const sellThreshold = appConfig?.signalThresholds?.sell ?? -12;

    let signal = 'NEUTRAL';
    let confidence = 50;

    if (weightedScore >= buyThreshold) signal = 'BUY';
    else if (weightedScore <= sellThreshold) signal = 'SELL';

    // confidence estimate from abs score
    const confCfg = appConfig?.confidence || {};
    const baseBuy = confCfg.baseBuy ?? 55;
    const baseSell = confCfg.baseSell ?? 55;
    const baseNeutral = confCfg.baseNeutral ?? 45;

    const perPointScore = confCfg.perPointScore ?? 0.5;
    const maxConfidence = confCfg.maxConfidence ?? 95;
    const minConfidence = confCfg.minConfidence ?? 25;

    const abs = Math.abs(weightedScore);
    if (signal === 'BUY') confidence = clamp(baseBuy + abs * perPointScore, minConfidence, maxConfidence);
    else if (signal === 'SELL') confidence = clamp(baseSell + abs * perPointScore, minConfidence, maxConfidence);
    else confidence = clamp(baseNeutral - abs * perPointScore, minConfidence, maxConfidence);

    // compute trade grade properly based on confidence
    const gradeFinal = calculateTradeGrade(weightedScore, confidence, regime, adxVal);

    return {
        tf: tfName,
        signal,
        confidence,
        weightedScore,
        regime,
        grade: gradeFinal,
        details: {
            trend: { score: trendFinal, detail: trendDetails.join(', ') },
            momentum: { score: momentumFinal, detail: momentumDetails.join(', ') },
            volatility: { score: volatilityFinal, detail: volatilityDetails.join(', ') },
            volume: { score: volumeFinal, detail: volumeDetails.join(', ') },
            structure: { score: structureFinal, detail: structureDetails.join(', ') }
        },
        indicators: {
            rsi: rsiVal,
            sma7: sma7v,
            sma25: sma25v,
            sma99: sma99v,
            macdV,
            signalV,
            histV,
            bbUpper,
            bbLower,
            bbMiddle,
            bbPercentB,
            bbBandwidth,
            atr: atrVal,
            adx: adxVal,
            pdi,
            mdi,
            obvSlope,
            cci: cciVal,
            wr: wrVal,
            vwap: vwapVal,
            ichimoku: { tenkan, kijun, senkouA, senkouB },
            keltner: { upper: kcUpper, lower: kcLower, middle: last(keltner.middle) },
            supertrend: { value: supertrendVal, direction: supertrendDir }
        }
    };
}

// ---------- Public engine: multi-TF ----------
function computeSignal({ candlesByTf, appConfig, symbol }) {
    // Check for symbol-specific special settings
    const symbolConfig = appConfig?.symbols?.[symbol] || {};
    const specialSettings = symbolConfig?.specialSettings || {};

    // Merge special settings with base config
    const mergedConfig = {
        ...appConfig,
        signalThresholds: specialSettings?.signalThresholds || appConfig?.signalThresholds,
        categoryWeights: specialSettings?.categoryWeights || appConfig?.categoryWeights,
        confidence: specialSettings?.confidence || appConfig?.confidence,
        indicators: specialSettings?.indicators || appConfig?.indicators,
        timeframes: specialSettings?.timeframes || appConfig?.timeframes
    };

    // Use special timeframes if available, else default
    const tfWeights = mergedConfig?.timeframes || { '1h': 50, '15m': 20, '4h': 30 };

    const timeframeAnalyses = {};
    for (const [tf, candles] of Object.entries(candlesByTf)) {
        const res = analyzeTimeframeTf(candles, tf, mergedConfig);
        if (res) timeframeAnalyses[tf] = res;
    }

    const confluencePayload = analyzeConfluence(timeframeAnalyses, {
        timeframeWeights: tfWeights,
        categoryWeights: mergedConfig?.categoryWeights,
        signalThresholds: mergedConfig?.signalThresholds,
        confidence: mergedConfig?.confidence
    });

    // regime/grade from 1h as primary if exists, else from overall
    const primary = timeframeAnalyses['1h'] || Object.values(timeframeAnalyses)[0];
    const regime = primary?.regime || confluencePayload?.results?.[0]?.details?.regime || 'Unknown';
    const grade = primary?.grade || { grade: 'NT', gradeColor: '#64748b', gradeLabel: 'NT', advice: '—' };

    const weightedScore = confluencePayload.weightedScore || 0;
    const confidence = confluencePayload.confidence ?? 50;

    const now = Date.now();
    const price = (() => {
        const p = primary?.indicators?.sma7 ? null : null;
        // use last close from primary candles
        if (primary && candlesByTf[primary.tf] && candlesByTf[primary.tf].length) {
            return candlesByTf[primary.tf][candlesByTf[primary.tf].length - 1].close;
        }
        return null;
    })();

    const multiTf = Object.fromEntries(Object.entries(timeframeAnalyses).map(([tf, r]) => ([
        tf,
        { signal: r.signal, confidence: r.confidence, score: r.weightedScore }
    ])));

    const breakdown = (() => {
        if (!primary?.details) return {};
        return {
            trend: primary.details.trend.score,
            momentum: primary.details.momentum.score,
            volatility: primary.details.volatility.score,
            volume: primary.details.volume.score,
            structure: primary.details.structure.score
        };
    })();

    // State machine: basic guard (NO_TRADE/WAIT)
    let state = 'WAIT';
    const noTradeConditions = [];
    if (!primary) noTradeConditions.push('Yetersiz veri');

    const regimeVal = regime;
    const adxVal = primary?.indicators?.adx ?? null;
    const bbBandwidth = primary?.indicators?.bbBandwidth ?? null;
    const atrVal = primary?.indicators?.atr ?? null;

    if (regimeVal === 'Chop') noTradeConditions.push('Chop rejimi');

    if (adxVal != null && adxVal < 15) noTradeConditions.push('ADX düşük');

    if (atrVal != null && price) {
        const atrPct = (atrVal / price) * 100;
        if (atrPct > 8) noTradeConditions.push('ATR yüksek');
    }

    if (grade?.grade === 'NT' || grade?.grade === 'C') noTradeConditions.push('Grade zayıf');

    if (confidence < 40) noTradeConditions.push('Confidence düşük');

    if (noTradeConditions.length) state = 'NO_TRADE';
    else if (grade?.grade === 'B' || confidence < (appConfig?.risk?.minConfidence ?? 60)) state = 'WAIT';
    else state = primary.signal === 'BUY' ? 'LONG' : primary.signal === 'SELL' ? 'SHORT' : 'WAIT';

    return {
        signal: confluencePayload.signal,
        confidence: Math.round(confidence),
        weightedScore: Math.round(weightedScore * 100) / 100,
        breakdown,
        tfAlignment: confluencePayload.tfAlignment,
        regime,
        grade: grade.grade,
        gradeColor: grade.gradeColor,
        price: price != null ? price : null,
        multiTf,
        state,
        symbol,
        timestamp: now,
        serverTime: new Date(now).toISOString(),
        _debug: {
            timeframeAnalyses: Object.keys(timeframeAnalyses)
        }
    };
}

module.exports = { computeSignal };
