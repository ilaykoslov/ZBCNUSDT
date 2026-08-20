// ZBCN-Specific Signal Engine with Feedback Loop
const fs = require('fs');
const path = require('path');

const EVAL_FILE = path.join(__dirname, '../../data/zbcn_eval.json');

// Initialize evaluation state if missing
function getEvalState() {
    try {
        if (fs.existsSync(EVAL_FILE)) {
            return JSON.parse(fs.readFileSync(EVAL_FILE, 'utf8'));
        }
    } catch (e) {
        console.error('Eval load error:', e.message);
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

function saveEvalState(state) {
    try {
        fs.writeFileSync(EVAL_FILE, JSON.stringify(state, null, 2));
    } catch (e) {
        console.error('Eval save error:', e.message);
    }
}

// ZBCN-specific regime detection overrides
function detectZbcnRegime(atrPct, adxValue) {
    // ZBCN typical hourly volatility is around 2.5% - 3.5%
    // If ATR% > 4.5%, it's highly volatile (Chop or Breakout)
    // If ADX < 20 on ZBCN, it's usually a tight range before a sudden move
    
    if (atrPct > 4.5 && adxValue < 20) return 'Volatile-Chop';
    if (atrPct > 4.5 && adxValue >= 25) return 'Volatile-Trend';
    if (atrPct < 1.5) return 'Low-Vol-Range';
    
    return null; // Fallback to standard regime detection
}

// Evaluate past signal outcome using Dynamic Thresholds based on ATR
function evaluateSignalOutcome(signalEntry, futureCandles, currentAtrPct = 3.0) {
    // Look ahead 4-6 candles to see if the signal was profitable
    if (!futureCandles || futureCandles.length < 4) return null;
    
    const entryPrice = signalEntry.price;
    const maxHigh = Math.max(...futureCandles.map(c => c.high));
    const minLow = Math.min(...futureCandles.map(c => c.low));
    
    // Dynamic TP/SL based on ATR (Volatility). 
    // Default fallback is 3% ATR if not provided.
    // TP = 1.5 * ATR, SL = 1.0 * ATR
    const tpPct = (currentAtrPct * 1.5) / 100;
    const slPct = (currentAtrPct * 1.0) / 100;
    
    if (signalEntry.signal === 'BUY') {
        if (maxHigh >= entryPrice * (1 + tpPct)) return true;
        if (minLow <= entryPrice * (1 - slPct)) return false;
    } else if (signalEntry.signal === 'SELL') {
        if (minLow <= entryPrice * (1 - tpPct)) return true;
        if (maxHigh >= entryPrice * (1 + slPct)) return false;
    }
    return null;
}

// Analyze orderbook microstructure for ZBCN
function analyzeZbcnMicrostructure(orderbook) {
    if (!orderbook || !orderbook.bids || !orderbook.asks || orderbook.bids.length === 0 || orderbook.asks.length === 0) {
        return { penalty: 0, reason: null };
    }
    
    try {
        const bestBid = parseFloat(orderbook.bids[0][0]);
        const bestAsk = parseFloat(orderbook.asks[0][0]);
        const spreadPct = ((bestAsk - bestBid) / bestBid) * 100;
        
        let bidVol = 0;
        let askVol = 0;
        // Check top 5 levels for immediate liquidity
        const depth = Math.min(5, orderbook.bids.length, orderbook.asks.length);
        for (let i = 0; i < depth; i++) {
            bidVol += parseFloat(orderbook.bids[i][1]);
            askVol += parseFloat(orderbook.asks[i][1]);
        }
        
        const imbalance = bidVol / (askVol || 1);
        
        // ZBCN typically has 0.1% - 0.25% spread. > 0.4% is illiquid.
        if (spreadPct > 0.4) {
            return { penalty: -15, reason: `Geniş Spread (${spreadPct.toFixed(2)}%)` };
        }
        
        // High imbalance warnings
        if (imbalance > 5) return { penalty: 0, bonus: 5, reason: 'Güçlü Alıcı Baskısı' };
        if (imbalance < 0.2) return { penalty: 0, bonus: -5, reason: 'Güçlü Satıcı Baskısı' };
        
    } catch (e) {
        return { penalty: 0, reason: null };
    }
    
    return { penalty: 0, reason: null };
}

// Check if system is in Cooldown
function isZbcnInCooldown(evalState) {
    if (!evalState) return false;
    if (evalState.cooldownUntil && Date.now() < evalState.cooldownUntil) {
        return true;
    }
    return false;
}

// Apply learning penalty to new signals and adjust category weights dynamically
function applyZbcnLearningPenalty(baseScore, evalState, baseWeights) {
    // 1. Cooldown check
    if (isZbcnInCooldown(evalState)) {
        // Return a heavily penalized score to force NEUTRAL
        return 0;
    }

    // 2. Adjust Category Weights based on past errors
    let adjustedWeights = { ...baseWeights };
    if (evalState.totalEvaluated > 10 && evalState.categoryErrors) {
        const totalErr = Object.values(evalState.categoryErrors).reduce((a,b)=>a+b, 0);
        if (totalErr > 0) {
            // Find the most failing category
            let worstCat = 'trend';
            let maxErr = -1;
            for (const [cat, errCount] of Object.entries(evalState.categoryErrors)) {
                if (errCount > maxErr) { maxErr = errCount; worstCat = cat; }
            }
            // Penalize worst category weight by 30% and distribute to others
            if (adjustedWeights[worstCat]) {
                const penalty = adjustedWeights[worstCat] * 0.3;
                adjustedWeights[worstCat] -= penalty;
                // distribute penalty to others (simplified)
                const others = Object.keys(adjustedWeights).filter(k => k !== worstCat);
                const add = penalty / others.length;
                others.forEach(k => adjustedWeights[k] += add);
            }
        }
    }

    // 3. Global accuracy penalty
    if (evalState.historicalAccuracy < 40 && evalState.totalEvaluated > 10) {
        return { score: baseScore * 0.8, weights: adjustedWeights };
    }
    
    return { score: baseScore, weights: adjustedWeights };
}

module.exports = {
    getEvalState,
    saveEvalState,
    detectZbcnRegime,
    evaluateSignalOutcome,
    applyZbcnLearningPenalty,
    analyzeZbcnMicrostructure,
    isZbcnInCooldown
};
