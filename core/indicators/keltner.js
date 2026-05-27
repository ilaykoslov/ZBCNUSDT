// =====================================================
// Keltner Channels İndikatörü
// =====================================================
// Middle Line: EMA (Exponential Moving Average) of Close Price, periyot: 20
// ATR (Average True Range), periyot: 10
// Upper Band: Middle Line + (Multiplier * ATR), multiplier: 2.0
// Lower Band: Middle Line - (Multiplier * ATR), multiplier: 2.0
// =====================================================

function calculateEMA(values, period = 20) {
    if (!values || values.length < period) {
        return Array(values.length).fill(null);
    }
    const ema = Array(values.length).fill(null);
    let sum = 0;
    for (let i = 0; i < period; i++) {
        sum += values[i];
    }
    let sma = sum / period;
    ema[period - 1] = sma;

    const multiplier = 2 / (period + 1);
    for (let i = period; i < values.length; i++) {
        ema[i] = (values[i] - ema[i - 1]) * multiplier + ema[i - 1];
    }
    return ema;
}

function calculateATR(candles, period = 10) {
    if (!candles || candles.length < period) {
        return Array(candles.length).fill(null);
    }
    const tr = [0];
    for (let i = 1; i < candles.length; i++) {
        const hl = candles[i].high - candles[i].low;
        const hc = Math.abs(candles[i].high - candles[i - 1].close);
        const lc = Math.abs(candles[i].low - candles[i - 1].close);
        tr.push(Math.max(hl, hc, lc));
    }

    const atr = Array(candles.length).fill(null);
    let trSum = tr.slice(1, period + 1).reduce((a, b) => a + b, 0) / period;
    atr[period] = trSum;

    for (let i = period + 1; i < candles.length; i++) {
        trSum = ((trSum * (period - 1)) + tr[i]) / period;
        atr[i] = trSum;
    }
    return atr;
}

function calculateKeltnerChannels(candles, emaPeriod = 20, atrPeriod = 10, multiplier = 2.0) {
    if (!candles || candles.length < Math.max(emaPeriod, atrPeriod)) {
        return {
            middle: Array(candles.length).fill(null),
            upper: Array(candles.length).fill(null),
            lower: Array(candles.length).fill(null)
        };
    }

    const closes = candles.map(c => c.close);
    const middle = calculateEMA(closes, emaPeriod);
    const atr = calculateATR(candles, atrPeriod);
    
    const upper = [];
    const lower = [];

    for (let i = 0; i < candles.length; i++) {
        const midVal = middle[i];
        const atrVal = atr[i];

        if (midVal === null || atrVal === null) {
            upper.push(null);
            lower.push(null);
        } else {
            upper.push(midVal + (multiplier * atrVal));
            lower.push(midVal - (multiplier * atrVal));
        }
    }

    return { middle, upper, lower };
}

function getKeltnerSignal(keltner, currentPrice) {
    if (!keltner || !keltner.middle || keltner.middle.length < 1) {
        return { signal: 'NEUTRAL', confidence: 0, details: [] };
    }

    const lastMid = keltner.middle[keltner.middle.length - 1];
    const lastUpper = keltner.upper[keltner.upper.length - 1];
    const lastLower = keltner.lower[keltner.lower.length - 1];

    if (lastMid === null || lastUpper === null || lastLower === null) {
        return { signal: 'NEUTRAL', confidence: 0, details: [] };
    }

    let score = 0;
    const details = [];

    // Fiyatın kanallara göre konumu
    if (currentPrice > lastUpper) {
        score -= 20; // Aşırı alım, mean-reversion riski
        details.push('Fiyat Üst Kanalın Üstünde (Aşırı Alım)');
    } else if (currentPrice < lastLower) {
        score += 20; // Aşırı satım, mean-reversion fırsatı
        details.push('Fiyat Alt Kanalın Altında (Aşırı Satım)');
    } else if (currentPrice > lastMid) {
        score += 10;
        details.push('Fiyat Orta Çizginin Üstünde (Boğa)');
    } else if (currentPrice < lastMid) {
        score -= 10;
        details.push('Fiyat Orta Çizginin Altında (Ayı)');
    }

    let signal = 'NEUTRAL';
    let confidence = 50;

    if (score >= 15) {
        signal = 'BUY';
        confidence = Math.min(85, 50 + score);
    } else if (score <= -15) {
        signal = 'SELL';
        confidence = Math.min(85, 50 + Math.abs(score));
    } else {
        confidence = Math.max(30, 50 - Math.abs(score));
    }

    return { signal, confidence, details };
}

module.exports = {
    calculateKeltnerChannels,
    getKeltnerSignal
};
