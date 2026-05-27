// =====================================================
// Ichimoku Cloud (Gökkuşağı Grafik) İndikatörü
// =====================================================
// Tenkan-sen (Conversion Line): (Highest High + Lowest Low) / 2, periyot: 9
// Kijun-sen (Base Line): (Highest High + Lowest Low) / 2, periyot: 26
// Senkou Span A (Leading Span A): (Tenkan + Kijun) / 2, 26 periyot ileri
// Senkou Span B (Leading Span B): (Highest High + Lowest Low) / 2, periyot: 52, 26 periyot ileri
// Chikou Span (Lagging Span): Kapanış, 26 periyot geri
// =====================================================

function calculateIchimoku(candles, tenkanPeriod = 9, kijunPeriod = 26, senkouBPeriod = 52, displacement = 26) {
    if (!candles || candles.length < senkouBPeriod + displacement) {
        return null;
    }

    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);
    const closes = candles.map(c => c.close);

    // Helper: Highest High ve Lowest Low hesapla
    function getHighestHigh(arr, period, endIdx) {
        if (endIdx < period - 1) return null;
        let max = -Infinity;
        for (let i = endIdx - period + 1; i <= endIdx; i++) {
            if (arr[i] > max) max = arr[i];
        }
        return max;
    }

    function getLowestLow(arr, period, endIdx) {
        if (endIdx < period - 1) return null;
        let min = Infinity;
        for (let i = endIdx - period + 1; i <= endIdx; i++) {
            if (arr[i] < min) min = arr[i];
        }
        return min;
    }

    const result = {
        tenkan: [],
        kijun: [],
        senkouA: [],
        senkouB: [],
        chikou: [],
        cloud: [] // { top, bottom, trend }
    };

    for (let i = 0; i < candles.length; i++) {
        // Tenkan-sen (9 periyot)
        const tenkanHigh = getHighestHigh(highs, tenkanPeriod, i);
        const tenkanLow = getLowestLow(lows, tenkanPeriod, i);
        result.tenkan.push(tenkanHigh !== null && tenkanLow !== null ? (tenkanHigh + tenkanLow) / 2 : null);

        // Kijun-sen (26 periyot)
        const kijunHigh = getHighestHigh(highs, kijunPeriod, i);
        const kijunLow = getLowestLow(lows, kijunPeriod, i);
        result.kijun.push(kijunHigh !== null && kijunLow !== null ? (kijunHigh + kijunLow) / 2 : null);

        // Senkou Span B (52 periyot)
        const senkouBHigh = getHighestHigh(highs, senkouBPeriod, i);
        const senkouBLow = getLowestLow(lows, senkouBPeriod, i);
        result.senkouB.push(senkouBHigh !== null && senkouBLow !== null ? (senkouBHigh + senkouBLow) / 2 : null);

        // Senkou Span A (26 periyot ileri)
        if (i >= displacement) {
            const tenkanPrev = result.tenkan[i - displacement];
            const kijunPrev = result.kijun[i - displacement];
            result.senkouA.push(tenkanPrev !== null && kijunPrev !== null ? (tenkanPrev + kijunPrev) / 2 : null);
        } else {
            result.senkouA.push(null);
        }

        // Chikou Span (26 periyot geri)
        if (i >= displacement) {
            result.chikou.push(closes[i - displacement]);
        } else {
            result.chikou.push(null);
        }

        // Cloud hesapla
        const sa = result.senkouA[i];
        const sb = result.senkouB[i];
        if (sa !== null && sb !== null) {
            result.cloud.push({
                top: Math.max(sa, sb),
                bottom: Math.min(sa, sb),
                trend: sa > sb ? 'bullish' : sa < sb ? 'bearish' : 'neutral'
            });
        } else {
            result.cloud.push({ top: null, bottom: null, trend: 'neutral' });
        }
    }

    return result;
}

// Ichimoku sinyal üretimi
function getIchimokuSignal(ichimoku, currentPrice) {
    if (!ichimoku || !ichimoku.tenkan || ichimoku.tenkan.length < 1) {
        return { signal: 'NEUTRAL', confidence: 0, details: [] };
    }

    const lastIdx = ichimoku.tenkan.length - 1;
    const tenkan = ichimoku.tenkan[lastIdx];
    const kijun = ichimoku.kijun[lastIdx];
    const cloud = ichimoku.cloud[lastIdx];
    const chikou = ichimoku.chikou[lastIdx];

    if (tenkan === null || kijun === null || cloud.top === null) {
        return { signal: 'NEUTRAL', confidence: 0, details: [] };
    }

    let score = 0;
    const details = [];

    // Tenkan-Kijun Cross (TK Cross)
    const tenkanPrev = ichimoku.tenkan[lastIdx - 1];
    const kijunPrev = ichimoku.kijun[lastIdx - 1];

    if (tenkanPrev !== null && kijunPrev !== null) {
        if (tenkanPrev <= kijunPrev && tenkan > kijun) {
            score += 25;
            details.push('TK Golden Cross (AL)');
        } else if (tenkanPrev >= kijunPrev && tenkan < kijun) {
            score -= 25;
            details.push('TK Death Cross (SAT)');
        }
    }

    // Price vs Cloud
    if (currentPrice > cloud.top) {
        score += 20;
        details.push('Fiyat Cloud üstünde (AL)');
    } else if (currentPrice < cloud.bottom) {
        score -= 20;
        details.push('Fiyat Cloud altında (SAT)');
    } else {
        score += 5;
        details.push('Fiyat Cloud içinde');
    }

    // Cloud trend
    if (cloud.trend === 'bullish') {
        score += 15;
        details.push('Bullish Cloud');
    } else if (cloud.trend === 'bearish') {
        score -= 15;
        details.push('Bearish Cloud');
    }

    // Chikou vs Price (26 periyot geri)
    if (chikou !== null) {
        if (chikou > currentPrice) {
            score += 15;
            details.push('Chikou fiyatın üstünde (AL)');
        } else if (chikou < currentPrice) {
            score -= 15;
            details.push('Chikou fiyatın altında (SAT)');
        }
    }

    // Tenkan vs Kijun (mevcut)
    if (tenkan > kijun) {
        score += 10;
        details.push('Tenkan > Kijun (AL)');
    } else if (tenkan < kijun) {
        score -= 10;
        details.push('Tenkan < Kijun (SAT)');
    }

    // Sinyal belirleme
    let signal = 'NEUTRAL';
    let confidence = 50;

    if (score >= 30) {
        signal = 'BUY';
        confidence = Math.min(90, 50 + score);
    } else if (score <= -30) {
        signal = 'SELL';
        confidence = Math.min(90, 50 + Math.abs(score));
    } else {
        confidence = Math.max(30, 50 - Math.abs(score));
    }

    return { signal, confidence, score, details };
}

module.exports = { calculateIchimoku, getIchimokuSignal };