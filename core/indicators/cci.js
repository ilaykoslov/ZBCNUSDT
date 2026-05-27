// =====================================================
// CCI (Commodity Channel Index) İndikatörü
// =====================================================
// CCI = (Typical Price - SMA) / (0.015 * Mean Deviation)
// Periyot: 20 (varsayılan)
// > +100: Aşırı Alım
// < -100: Aşırı Satım
// =====================================================

function calculateCCI(candles, period = 20) {
    if (!candles || candles.length < period) {
        return Array(candles.length).fill(null);
    }

    // Typical Price = (High + Low + Close) / 3
    const typicalPrices = candles.map(c => (c.high + c.low + c.close) / 3);
    const result = [];

    for (let i = 0; i < candles.length; i++) {
        if (i < period - 1) {
            result.push(null);
            continue;
        }

        // SMA of Typical Price
        let sum = 0;
        for (let j = i - period + 1; j <= i; j++) {
            sum += typicalPrices[j];
        }
        const sma = sum / period;

        // Mean Deviation
        let meanDevSum = 0;
        for (let j = i - period + 1; j <= i; j++) {
            meanDevSum += Math.abs(typicalPrices[j] - sma);
        }
        const meanDeviation = meanDevSum / period;

        // CCI Formülü
        if (meanDeviation === 0) {
            result.push(0);
        } else {
            const cci = (typicalPrices[i] - sma) / (0.015 * meanDeviation);
            result.push(cci);
        }
    }

    return result;
}

// CCI sinyal üretimi
function getCciSignal(cciArr, currentPrice) {
    if (!cciArr || cciArr.length < 1) {
        return { signal: 'NEUTRAL', confidence: 0, details: [] };
    }

    const last = cciArr[cciArr.length - 1];
    const prev = cciArr.length > 1 ? cciArr[cciArr.length - 2] : null;

    if (last === null) {
        return { signal: 'NEUTRAL', confidence: 0, details: [] };
    }

    let score = 0;
    const details = [];

    // Sınır seviyeleri
    if (last < -100) {
        score += 25;
        details.push('Aşırı Satım (-100 altı)');
    } else if (last > 100) {
        score -= 25;
        details.push('Aşırı Alım (+100 üstü)');
    } else {
        score += 5;
        details.push('Nötr Bölge');
    }

    // Zero line cross
    if (prev !== null) {
        if (prev < 0 && last > 0) {
            score += 20;
            details.push('Zero Line Cross (AL)');
        } else if (prev > 0 && last < 0) {
            score -= 20;
            details.push('Zero Line Cross (SAT)');
        }
    }

    // Extreme levels
    if (last < -150) {
        score += 10;
        details.push('Çok Aşırı Satım');
    } else if (last > 150) {
        score -= 10;
        details.push('Çok Aşırı Alım');
    }

    // Momentum
    if (prev !== null) {
        if (last > prev) {
            score += 10;
            details.push('CCI Yükseliyor');
        } else if (last < prev) {
            score -= 10;
            details.push('CCI Düşüyor');
        }
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

module.exports = { calculateCCI, getCciSignal };