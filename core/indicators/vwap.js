// =====================================================
// VWAP (Volume Weighted Average Price) İndikatörü
// =====================================================
// VWAP = Cumulative (Price * Volume) / Cumulative Volume
// Periyot: Günlük (varsayılan)
// =====================================================

function calculateVWAP(candles) {
    if (!candles || candles.length < 1) {
        return Array(candles.length).fill(null);
    }

    const result = [];
    let cumPriceVol = 0;
    let cumVolume = 0;

    for (let i = 0; i < candles.length; i++) {
        // Typical Price
        const typicalPrice = (candles[i].high + candles[i].low + candles[i].close) / 3;
        const volume = candles[i].volume;

        cumPriceVol += typicalPrice * volume;
        cumVolume += volume;

        if (cumVolume > 0) {
            result.push(cumPriceVol / cumVolume);
        } else {
            result.push(null);
        }
    }

    return result;
}

// VWAP sinyal üretimi
function getVwapSignal(vwapArr, currentPrice) {
    if (!vwapArr || vwapArr.length < 1) {
        return { signal: 'NEUTRAL', confidence: 0, details: [] };
    }

    const last = vwapArr[vwapArr.length - 1];

    if (last === null) {
        return { signal: 'NEUTRAL', confidence: 0, details: [] };
    }

    let score = 0;
    const details = [];

    // Price vs VWAP
    if (currentPrice > last) {
        score += 30;
        details.push('Fiyat VWAP üstünde (AL)');
    } else if (currentPrice < last) {
        score -= 30;
        details.push('Fiyat VWAP altında (SAT)');
    } else {
        score += 5;
        details.push('Fiyat VWAP üzerinde');
    }

    // VWAP eğimi (yakın zamanda)
    if (vwapArr.length > 3) {
        const vwap3 = vwapArr[vwapArr.length - 3];
        const vwap2 = vwapArr[vwapArr.length - 2];
        const vwap1 = vwapArr[vwapArr.length - 1];

        if (vwap1 > vwap2 && vwap2 > vwap3) {
            score += 15;
            details.push('VWAP Yükseliyor');
        } else if (vwap1 < vwap2 && vwap2 < vwap3) {
            score -= 15;
            details.push('VWAP Düşüyor');
        }
    }

    // Mean reversion potansiyeli
    const distancePct = ((currentPrice - last) / last) * 100;
    if (distancePct > 3) {
        score -= 10;
        details.push('VWAP\'ten Uzak (Mean Reversion)');
    } else if (distancePct < -3) {
        score += 10;
        details.push('VWAP\'ten Uzak (Mean Reversion)');
    }

    // Sinyal belirleme
    let signal = 'NEUTRAL';
    let confidence = 50;

    if (score >= 20) {
        signal = 'BUY';
        confidence = Math.min(85, 50 + score);
    } else if (score <= -20) {
        signal = 'SELL';
        confidence = Math.min(85, 50 + Math.abs(score));
    } else {
        confidence = Math.max(30, 50 - Math.abs(score));
    }

    return { signal, confidence, score, details };
}

module.exports = { calculateVWAP, getVwapSignal };