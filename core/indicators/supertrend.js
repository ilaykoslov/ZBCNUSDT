// =====================================================
// Supertrend İndikatörü
// =====================================================
// Basic Upper Band = (High + Low) / 2 + (Multiplier * ATR)
// Basic Lower Band = (High + Low) / 2 - (Multiplier * ATR)
// Periyot: 10 (varsayılan), Multiplier: 3.0 (varsayılan)
// =====================================================

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

function calculateSupertrend(candles, period = 10, multiplier = 3.0) {
    const length = candles.length;
    if (length < period) {
        return {
            supertrend: Array(length).fill(null),
            direction: Array(length).fill(null) // 1 for Uptrend, -1 for Downtrend
        };
    }

    const atr = calculateATR(candles, period);
    const supertrend = Array(length).fill(null);
    const direction = Array(length).fill(null);

    const basicUpperBand = Array(length).fill(null);
    const basicLowerBand = Array(length).fill(null);
    const finalUpperBand = Array(length).fill(null);
    const finalLowerBand = Array(length).fill(null);

    for (let i = 0; i < length; i++) {
        if (i < period) continue;

        const hl2 = (candles[i].high + candles[i].low) / 2;
        const atrVal = atr[i];

        if (atrVal === null) continue;

        basicUpperBand[i] = hl2 + (multiplier * atrVal);
        basicLowerBand[i] = hl2 - (multiplier * atrVal);

        // Final Upper Band
        if (i > 0 && basicUpperBand[i] < finalUpperBand[i - 1] || candles[i - 1].close > finalUpperBand[i - 1]) {
            finalUpperBand[i] = basicUpperBand[i];
        } else {
            finalUpperBand[i] = finalUpperBand[i - 1];
        }

        // Final Lower Band
        if (i > 0 && basicLowerBand[i] > finalLowerBand[i - 1] || candles[i - 1].close < finalLowerBand[i - 1]) {
            finalLowerBand[i] = basicLowerBand[i];
        } else {
            finalLowerBand[i] = finalLowerBand[i - 1];
        }

        // Direction & Supertrend Line
        if (i === period) {
            direction[i] = 1;
            supertrend[i] = finalLowerBand[i];
        } else {
            if (supertrend[i - 1] === finalUpperBand[i - 1]) {
                direction[i] = candles[i].close > finalUpperBand[i] ? 1 : -1;
            } else {
                direction[i] = candles[i].close < finalLowerBand[i] ? -1 : 1;
            }

            supertrend[i] = direction[i] === 1 ? finalLowerBand[i] : finalUpperBand[i];
        }
    }

    return { supertrend, direction };
}

function getSupertrendSignal(supertrendResult, currentPrice) {
    if (!supertrendResult || !supertrendResult.supertrend || supertrendResult.supertrend.length < 1) {
        return { signal: 'NEUTRAL', confidence: 0, details: [] };
    }

    const lastDir = supertrendResult.direction[supertrendResult.direction.length - 1];
    const lastLine = supertrendResult.supertrend[supertrendResult.supertrend.length - 1];

    if (lastDir === null || lastLine === null) {
        return { signal: 'NEUTRAL', confidence: 0, details: [] };
    }

    let signal = 'NEUTRAL';
    let confidence = 50;
    const details = [];

    if (lastDir === 1) {
        signal = 'BUY';
        confidence = 75;
        details.push(`Supertrend YÜKSELİŞTE (Fiyat > $${lastLine.toFixed(6)})`);
    } else if (lastDir === -1) {
        signal = 'SELL';
        confidence = 75;
        details.push(`Supertrend DÜŞÜŞTE (Fiyat < $${lastLine.toFixed(6)})`);
    }

    return { signal, confidence, details };
}

module.exports = {
    calculateSupertrend,
    getSupertrendSignal
};
