// Symbol-Specific Signal Engine with Feedback Loop (Multi-Symbol)
const fs = require('fs');
const path = require('path');

// Sembol bazlı varsayılan volatilite profilleri (ATR% threshold, Spread vb.)
const SYMBOL_PROFILES = {
    'ZBCNUSDT': {
        volatilityHigh: 4.5,
        volatilityLow: 1.5,
        spreadMax: 0.4,
        imbalanceHigh: 5,
        imbalanceLow: 0.2,
        defaultAtr: 3.0,
        tpMult: 1.5,
        slMult: 1.0
    },
    'PROSUSDT': {
        volatilityHigh: 2.0,
        volatilityLow: 0.5,
        spreadMax: 0.3,
        imbalanceHigh: 4,
        imbalanceLow: 0.25,
        defaultAtr: 1.0,
        tpMult: 1.2,
        slMult: 0.8
    },
    'WLFIUSDT': {
        volatilityHigh: 3.0,
        volatilityLow: 1.0,
        spreadMax: 0.5,
        imbalanceHigh: 6,
        imbalanceLow: 0.15,
        defaultAtr: 2.0,
        tpMult: 1.5,
        slMult: 1.0
    },
    'SOLUSDT': {
        volatilityHigh: 1.5,
        volatilityLow: 0.4,
        spreadMax: 0.1,
        imbalanceHigh: 3,
        imbalanceLow: 0.3,
        defaultAtr: 0.8,
        tpMult: 2.0, // Major coin, trend takibi daha uzun sürebilir
        slMult: 1.0
    }
};

function getEvalFilePath(symbol) {
    return path.join(__dirname, `../../data/${symbol.toLowerCase()}_eval.json`);
}

// Initialize evaluation state if missing
function getEvalState(symbol) {
    const file = getEvalFilePath(symbol);
    try {
        if (fs.existsSync(file)) {
            return JSON.parse(fs.readFileSync(file, 'utf8'));
        }
    } catch (e) {
        console.error(`Eval load error for ${symbol}:`, e.message);
    }
    return {
        falsePositives: 0,
        truePositives: 0,
        totalEvaluated: 0,
        historicalAccuracy: 50, // baseline
        lastEvaluatedTimestamp: 0,
        recentFailures: 0,      // Cooldown counter
        cooldownUntil: 0,       // Timestamp
        categoryErrors: {
            trend: 0,
            momentum: 0,
            volatility: 0,
            volume: 0,
            structure: 0
        }
    };
}

function saveEvalState(symbol, state) {
    const file = getEvalFilePath(symbol);
    try {
        fs.writeFileSync(file, JSON.stringify(state, null, 2));
    } catch (e) {
        console.error(`Eval save error for ${symbol}:`, e.message);
    }
}

// Symbol-specific regime detection overrides
function detectSymbolRegime(symbol, atrPct, adxValue) {
    const profile = SYMBOL_PROFILES[symbol] || SYMBOL_PROFILES['ZBCNUSDT'];
    
    if (atrPct > profile.volatilityHigh && adxValue < 20) return 'Volatile-Chop';
    if (atrPct > profile.volatilityHigh && adxValue >= 25) return 'Volatile-Trend';
    if (atrPct < profile.volatilityLow) return 'Low-Vol-Range';
    
    return null; // Fallback to standard regime detection
}

// Evaluate past signal outcome using Dynamic Thresholds based on ATR
function evaluateSignalOutcome(symbol, signalEntry, futureCandles, currentAtrPct) {
    if (!futureCandles || futureCandles.length < 4) return null;
    
    const profile = SYMBOL_PROFILES[symbol] || SYMBOL_PROFILES['ZBCNUSDT'];
    const atrToUse = currentAtrPct || profile.defaultAtr;
    
    const entryPrice = signalEntry.price;
    const maxHigh = Math.max(...futureCandles.map(c => c.high));
    const minLow = Math.min(...futureCandles.map(c => c.low));
    
    const tpPct = (atrToUse * profile.tpMult) / 100;
    const slPct = (atrToUse * profile.slMult) / 100;
    
    if (signalEntry.signal === 'BUY') {
        if (maxHigh >= entryPrice * (1 + tpPct)) return true;
        if (minLow <= entryPrice * (1 - slPct)) return false;
    } else if (signalEntry.signal === 'SELL') {
        if (minLow <= entryPrice * (1 - tpPct)) return true;
        if (maxHigh >= entryPrice * (1 + slPct)) return false;
    }
    return null;
}

// Analyze orderbook microstructure
function analyzeMicrostructure(symbol, orderbook) {
    if (!orderbook || !orderbook.bids || !orderbook.asks || orderbook.bids.length === 0 || orderbook.asks.length === 0) {
        return { penalty: 0, reason: null };
    }
    
    const profile = SYMBOL_PROFILES[symbol] || SYMBOL_PROFILES['ZBCNUSDT'];
    
    try {
        const bestBid = parseFloat(orderbook.bids[0][0]);
        const bestAsk = parseFloat(orderbook.asks[0][0]);
        const spreadPct = ((bestAsk - bestBid) / bestBid) * 100;
        
        let bidVol = 0;
        let askVol = 0;
        const depth = Math.min(5, orderbook.bids.length, orderbook.asks.length);
        for (let i = 0; i < depth; i++) {
            bidVol += parseFloat(orderbook.bids[i][1]);
            askVol += parseFloat(orderbook.asks[i][1]);
        }
        
        const imbalance = bidVol / (askVol || 1);
        
        if (spreadPct > profile.spreadMax) {
            return { penalty: -15, reason: `Geniş Spread (${spreadPct.toFixed(2)}%)` };
        }
        
        if (imbalance > profile.imbalanceHigh) return { penalty: 0, bonus: 5, reason: 'Güçlü Alıcı Baskısı' };
        if (imbalance < profile.imbalanceLow) return { penalty: 0, bonus: -5, reason: 'Güçlü Satıcı Baskısı' };
        
    } catch (e) {
        return { penalty: 0, reason: null };
    }
    
    return { penalty: 0, reason: null };
}

// Check if system is in Cooldown
function isSymbolInCooldown(evalState) {
    if (!evalState) return false;
    if (evalState.cooldownUntil && Date.now() < evalState.cooldownUntil) {
        return true;
    }
    return false;
}

// Apply learning penalty to new signals and adjust category weights dynamically
function applyLearningPenalty(baseScore, evalState, baseWeights) {
    if (isSymbolInCooldown(evalState)) {
        return { score: 0, weights: baseWeights };
    }

    let adjustedWeights = { ...baseWeights };
    if (evalState.totalEvaluated > 10 && evalState.categoryErrors) {
        const totalErr = Object.values(evalState.categoryErrors).reduce((a,b)=>a+b, 0);
        if (totalErr > 0) {
            let worstCat = 'trend';
            let maxErr = -1;
            for (const [cat, errCount] of Object.entries(evalState.categoryErrors)) {
                if (errCount > maxErr) { maxErr = errCount; worstCat = cat; }
            }
            if (adjustedWeights[worstCat]) {
                const penalty = adjustedWeights[worstCat] * 0.3;
                adjustedWeights[worstCat] -= penalty;
                const others = Object.keys(adjustedWeights).filter(k => k !== worstCat);
                const add = penalty / others.length;
                others.forEach(k => adjustedWeights[k] += add);
            }
        }
    }

    if (evalState.historicalAccuracy < 40 && evalState.totalEvaluated > 10) {
        return { score: baseScore * 0.8, weights: adjustedWeights };
    }
    
    return { score: baseScore, weights: adjustedWeights };
}

module.exports = {
    getEvalState,
    saveEvalState,
    detectSymbolRegime,
    evaluateSignalOutcome,
    applyLearningPenalty,
    analyzeMicrostructure,
    isSymbolInCooldown
};
