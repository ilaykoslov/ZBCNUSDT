// =====================================================
// Volume Profile (Hacim Profili) İndikatörü
// =====================================================
// PVP (Point of Control): En yüksek hacmin olduğu fiyat seviyesi
// Value Area: Toplam hacmin %70'ini oluşturan fiyat aralığı
// =====================================================

function calculateVolumeProfile(candles, numBins = 50) {
    if (!candles || candles.length < 1) {
        return null;
    }

    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);
    const closes = candles.map(c => c.close);
    const volumes = candles.map(c => c.volume);

    const minPrice = Math.min(...lows);
    const maxPrice = Math.max(...highs);
    const priceRange = maxPrice - minPrice || 1;
    const binSize = priceRange / numBins;

    // Hacim binleri oluştur
    const bins = {};
    let totalVolume = 0;

    for (let i = 0; i < candles.length; i++) {
        const binIndex = Math.floor((closes[i] - minPrice) / binSize);
        const binKey = Math.min(binIndex, numBins - 1);
        const price = minPrice + binKey * binSize + binSize / 2;

        if (!bins[price]) {
            bins[price] = 0;
        }
        bins[price] += volumes[i];
        totalVolume += volumes[i];
    }

    // PVP (Point of Control) - En yüksek hacimli fiyat
    let pvpPrice = null;
    let pvpVolume = 0;
    for (const [price, volume] of Object.entries(bins)) {
        if (volume > pvpVolume) {
            pvpVolume = volume;
            pvpPrice = parseFloat(price);
        }
    }

    // Value Area (toplam hacmin %70'i)
    const sortedPrices = Object.keys(bins).map(parseFloat).sort((a, b) => a - b);
    const valueAreaVolume = totalVolume * 0.70;

    let valueAreaLow = null;
    let valueAreaHigh = null;
    let cumulativeVolume = 0;

    // PVP'den başla ve iki yöne de genişle
    const pvpIndex = sortedPrices.indexOf(pvpPrice);
    if (pvpIndex >= 0) {
        let left = pvpIndex;
        let right = pvpIndex;

        while (cumulativeVolume < valueAreaVolume && (left > 0 || right < sortedPrices.length - 1)) {
            const leftVol = left > 0 ? bins[sortedPrices[left - 1]] : 0;
            const rightVol = right < sortedPrices.length - 1 ? bins[sortedPrices[right + 1]] : 0;

            if (leftVol >= rightVol && left > 0) {
                cumulativeVolume += leftVol;
                left--;
            } else if (right < sortedPrices.length - 1) {
                cumulativeVolume += rightVol;
                right++;
            } else {
                break;
            }
        }

        valueAreaLow = sortedPrices[left];
        valueAreaHigh = sortedPrices[right];
    }

    return {
        bins,
        pvpPrice,
        pvpVolume,
        valueAreaLow,
        valueAreaHigh,
        totalVolume,
        minPrice,
        maxPrice
    };
}

// Volume Profile sinyal üretimi
function getVolumeProfileSignal(volumeProfile, currentPrice) {
    if (!volumeProfile) {
        return { signal: 'NEUTRAL', confidence: 0, details: [] };
    }

    const { pvpPrice, valueAreaLow, valueAreaHigh } = volumeProfile;

    if (pvpPrice === null) {
        return { signal: 'NEUTRAL', confidence: 0, details: [] };
    }

    let score = 0;
    const details = [];

    // Price vs PVP
    if (currentPrice > pvpPrice) {
        score += 15;
        details.push('Fiyat PVP üstünde');
    } else if (currentPrice < pvpPrice) {
        score -= 15;
        details.push('Fiyat PVP altında');
    }

    // Price vs Value Area
    if (valueAreaLow !== null && valueAreaHigh !== null) {
        if (currentPrice > valueAreaHigh) {
            score -= 10;
            details.push('Value Area üstünde (Aşırı Alım)');
        } else if (currentPrice < valueAreaLow) {
            score += 10;
            details.push('Value Area altında (Aşırı Satım)');
        } else {
            score += 10;
            details.push('Value Area içinde');
        }
    }

    // PVP strength (hacim oranı)
    const totalVolume = volumeProfile.totalVolume;
    if (totalVolume > 0) {
        const pvpRatio = pvpPrice / totalVolume;
        if (pvpRatio > 0.05) {
            score += 10;
            details.push('Güçlü PVP');
        }
    }

    // Sinyal belirleme
    let signal = 'NEUTRAL';
    let confidence = 50;

    if (score >= 15) {
        signal = 'BUY';
        confidence = Math.min(80, 50 + score);
    } else if (score <= -15) {
        signal = 'SELL';
        confidence = Math.min(80, 50 + Math.abs(score));
    } else {
        confidence = Math.max(30, 50 - Math.abs(score));
    }

    return { signal, confidence, score, details };
}

module.exports = { calculateVolumeProfile, getVolumeProfileSignal };