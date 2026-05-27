// =====================================================
// Williams %R İndikatörü
// =====================================================
// %R = (Highest High - Close) / (Highest High - Lowest Low) * -100
// Periyot: 14 (varsayılan)
// > -20: Aşırı Alım (SAT)
// < -80: Aşırı Satım (AL)
// -20 ile -80 arası: Nötr
// =====================================================

function calculateWilliamsR(candles, period = 14) {
    if (!candles || candles.length < period) {
        return Array(candles.length).fill(null);
    }

    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);
    const closes = candles.map(c => c.close);
    const result = [];

    for (let i = 0; i < candles.length; i++) {
        if (i < period - 1) {
            result.push(null);
            continue;
        }

        // Highest High (son N periyot)
        let highestHigh = -Infinity;
        for (let j = i - period + 1; j <= i; j++) {
            if (highs[j] > highestHigh) highestHigh = highs[j];
        }

        // Lowest Low (son N periyot)
        let lowestLow = Infinity;
        for (let j = i - period + 1; j <= i; j++) {
            if (lows[j] < lowestLow) lowestLow = lows[j];
        }

        // Williams %R formülü
        const close = closes[i];
        const denominator = highestHigh - lowestLow;

        if (denominator === 0) {
            result.push(-50); // Division by zero koruması
        } else {
            const wr = ((highestHigh - close) / denominator) * -100;
            result.push(wr);
        }
    }

    return result;
}

// Williams %R sinyal üretimi
function getWilliamsRSignal(wrArr, currentPrice) {
    if (!wrArr || wrArr.length < 1) {
        return { signal: 'NEUTRAL', confidence: 0, details: [] };
    }

    const last = wrArr[wrArr.length - 1];
    const prev = wrArr.length > 1 ? wrArr[wrArr.length - 2] : null;

    if (last === null) {
        return { signal: 'NEUTRAL', confidence: 0, details: [] };
    }

    let score = 0;
    const details = [];

    // Aşırı seviyeler
    if (last < -80) {
        score += 25;
        details.push('Aşırı Satım (AL)');
    } else if (last > -20) {
        score -= 25;
        details.push('Aşırı Alım (SAT)');
    } else {
        score += 5;
        details.push('Nötr Bölge');
    }

    // Momentum (yükseliyor/düşüyor)
    if (prev !== null) {
        if (last > prev && last < -50) {
            score += 15;
            details.push('Yükseliş Momentumu');
        } else if (last < prev && last > -50) {
            score -= 15;
            details.push('Düşüş Momentumu');
        }
    }

    // Overbought/oversold reversal potansiyeli
    if (last < -90) {
        score += 10;
        details.push('Çok Aşırı Satım (Reversal)');
    } else if (last > -10) {
        score -= 10;
        details.push('Çok Aşırı Alım (Reversal)');
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

module.exports = { calculateWilliamsR, getWilliamsRSignal };