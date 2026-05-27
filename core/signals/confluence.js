// =====================================================
// Confluence Sinyal Motoru
// =====================================================
// Multi-timeframe ve multi-indicator confluence analizi
// =====================================================

function analyzeConfluence(timeframesData, config = {}) {
    const {
        timeframeWeights = { '1h': 50, '15m': 20, '4h': 30 },
        categoryWeights = { trend: 30, momentum: 25, volatility: 15, volume: 15, structure: 15 },
        signalThresholds = { buy: 12, sell: -12 },
        confidence = { baseBuy: 55, baseSell: 55, baseNeutral: 45, maxConfidence: 95, minConfidence: 25, perPointScore: 0.5 }
    } = config;

    const results = [];
    let totalWeight = 0;
    let weightedSignalSum = 0;
    let avgConfidence = 0;

    // Her timeframe için analiz
    for (const [tf, data] of Object.entries(timeframesData)) {
        if (!data || !data.signal) continue;

        const w = timeframeWeights[tf] || 25;
        totalWeight += w;

        const signalVal = data.signal === 'BUY' ? 1 : data.signal === 'SELL' ? -1 : 0;
        weightedSignalSum += signalVal * w * (data.confidence / 100);
        avgConfidence += data.confidence * w;

        results.push({
            tf,
            signal: data.signal,
            confidence: data.confidence,
            score: data.weightedScore || 0,
            details: data.details || {}
        });
    }

    if (totalWeight === 0) {
        return {
            signal: 'NEUTRAL',
            confidence: 50,
            weightedScore: 0,
            tfAlignment: 'Yetersiz Veri',
            results
        };
    }

    // Ağırlıklı ortalama
    const finalSignalValue = weightedSignalSum / totalWeight;
    avgConfidence = avgConfidence / totalWeight;

    // Nihai sinyal
    let finalSignal, finalConfidence;
    if (finalSignalValue >= 0.2) {
        finalSignal = 'BUY';
        finalConfidence = Math.min(confidence.maxConfidence, avgConfidence + 10);
    } else if (finalSignalValue <= -0.2) {
        finalSignal = 'SELL';
        finalConfidence = Math.min(confidence.maxConfidence, avgConfidence + 10);
    } else {
        finalSignal = 'NEUTRAL';
        finalConfidence = Math.max(confidence.minConfidence, avgConfidence - 15);
    }

    // TF uyumu
    const signals = results.map(r => r.signal);
    const buyCount = signals.filter(s => s === 'BUY').length;
    const sellCount = signals.filter(s => s === 'SELL').length;

    let tfAlignment;
    if (buyCount === results.length) {
        tfAlignment = 'Tam Uyum (AL)';
        finalConfidence = Math.min(98, finalConfidence + 15);
    } else if (sellCount === results.length) {
        tfAlignment = 'Tam Uyum (SAT)';
        finalConfidence = Math.min(98, finalConfidence + 15);
    } else if (buyCount > sellCount) {
        tfAlignment = 'Kısmi Uyum (AL ağırlıklı)';
    } else if (sellCount > buyCount) {
        tfAlignment = 'Kısmi Uyum (SAT ağırlıklı)';
    } else if (results.length > 1) {
        tfAlignment = 'Karışık (bekle)';
    } else {
        tfAlignment = 'Tek TF';
    }

    // Ağırlıklı skor
    const weightedScore = results.reduce((sum, r) => sum + (r.score || 0) * (timeframeWeights[r.tf] || 25), 0) / totalWeight;

    return {
        signal: finalSignal,
        confidence: Math.max(5, Math.min(95, finalConfidence)),
        weightedScore,
        tfAlignment,
        results,
        buyCount,
        sellCount,
        neutralCount: results.length - buyCount - sellCount
    };
}

// Piyasa rejimi tespiti
function detectMarketRegime(adxVal, bbBandwidth, atrPct, smaSlope, priceSlope) {
    if (adxVal === null || bbBandwidth === null) return 'Unknown';

    const strongTrend = adxVal >= 25;
    const moderateTrend = adxVal >= 20;
    const bbSqueeze = bbBandwidth < 0.03;
    const lowVol = atrPct < 2;
    const highVol = atrPct > 5;

    if (strongTrend && smaSlope > 0.05) return 'Trend-Up';
    if (strongTrend && smaSlope < -0.05) return 'Trend-Down';
    if (!moderateTrend && (bbSqueeze || lowVol)) return 'Chop';
    if (!moderateTrend && !bbSqueeze) return 'Range';
    if (moderateTrend && !strongTrend) return 'Range';

    return 'Range';
}

// Rejime göre ağırlık ayarı
function getRegimeWeights(regime, baseWeights) {
    const w = { ...baseWeights };

    if (regime === 'Trend-Up' || regime === 'Trend-Down') {
        w.trend = Math.min(45, w.trend + 10);
        w.momentum = Math.min(30, w.momentum + 5);
        w.volatility = Math.max(5, w.volatility - 5);
        w.structure = Math.max(10, w.structure - 3);
    } else if (regime === 'Range' || regime === 'Chop') {
        w.volatility = Math.min(25, w.volatility + 10);
        w.structure = Math.min(25, w.structure + 5);
        w.trend = Math.max(15, w.trend - 10);
        w.momentum = Math.max(20, w.momentum - 5);
    }

    return w;
}

// Trade grade hesaplama
function calculateTradeGrade(weightedScore, confidence, regime, adxVal) {
    const absScore = Math.abs(weightedScore);
    const absConf = Math.abs(confidence);

    let grade, gradeColor, gradeLabel;

    if (absScore >= 25 && absConf >= 85 && (regime === 'Trend-Up' || regime === 'Trend-Down')) {
        grade = 'S'; gradeColor = '#a855f7'; gradeLabel = '⚡ SÜPER (Yüksek Güven)';
    } else if (absScore >= 18 && absConf >= 70) {
        grade = 'A'; gradeColor = '#22c55e'; gradeLabel = 'A (Güçlü Sinyal)';
    } else if (absScore >= 12 && absConf >= 55) {
        grade = 'B'; gradeColor = '#06b6d4'; gradeLabel = 'B (Orta Sinyal)';
    } else if (absScore >= 6 && absConf >= 40) {
        grade = 'C'; gradeColor = '#eab308'; gradeLabel = 'C (Zayıf Sinyal)';
    } else {
        grade = 'NT'; gradeColor = '#64748b'; gradeLabel = 'NT (İşlem Yok)';
    }

    // Risk düzeltmesi
    if (regime === 'Chop' && grade === 'A') { grade = 'B'; gradeLabel = 'B (Chop-Orta)'; gradeColor = '#06b6d4'; }
    else if (regime === 'Chop' && grade === 'S') { grade = 'A'; gradeLabel = 'A (Chop-Güçlü)'; gradeColor = '#22c55e'; }

    let advice = '';
    if (weightedScore > 0) {
        if (grade === 'S') advice = '🔴 GÜÇLÜ AL - Trend ve momentum uyumlu.';
        else if (grade === 'A') advice = '🟢 AL - Confluence olumlu.';
        else if (grade === 'B') advice = '🔵 HAFIF AL - Teyit bekle.';
        else if (grade === 'C') advice = '🟡 DİKKAT - Zayıf sinyal, risk yüksek.';
        else advice = '⚪ BEKLE - Net sinyal yok.';
    } else if (weightedScore < 0) {
        if (grade === 'S') advice = '🔴 GÜÇLÜ SAT - Trend ve momentum uyumlu.';
        else if (grade === 'A') advice = '🔴 SAT - Confluence olumsuz.';
        else if (grade === 'B') advice = '🔵 HAFIF SAT - Teyit bekle.';
        else if (grade === 'C') advice = '🟡 DİKKAT - Zayıf sinyal, risk yüksek.';
        else advice = '⚪ BEKLE - Net sinyal yok.';
    } else {
        advice = '⚪ NÖTR - BEKLE. Confluence karışık.';
    }

    return { grade, gradeColor, gradeLabel, advice };
}

module.exports = { analyzeConfluence, detectMarketRegime, getRegimeWeights, calculateTradeGrade };