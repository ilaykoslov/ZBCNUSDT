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
        lastEvaluatedTimestamp: 0
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

// Evaluate past signal outcome
function evaluateSignalOutcome(signalEntry, futureCandles) {
    // Look ahead 4-6 candles to see if the signal was profitable
    // Return true if successful, false if failed, null if undetermined
    if (!futureCandles || futureCandles.length < 4) return null;
    
    const entryPrice = signalEntry.price;
    const maxHigh = Math.max(...futureCandles.map(c => c.high));
    const minLow = Math.min(...futureCandles.map(c => c.low));
    
    // Simple 2% take profit, 1% stop loss logic for ZBCN
    if (signalEntry.signal === 'BUY') {
        if (maxHigh >= entryPrice * 1.02) return true;
        if (minLow <= entryPrice * 0.99) return false;
    } else if (signalEntry.signal === 'SELL') {
        if (minLow <= entryPrice * 0.98) return true;
        if (maxHigh >= entryPrice * 1.01) return false;
    }
    return null;
}

// Apply learning penalty to new signals
function applyZbcnLearningPenalty(baseScore, evalState) {
    // If recent historical accuracy is poor (< 40%), penalize the score to reduce false signals
    if (evalState.historicalAccuracy < 40 && evalState.totalEvaluated > 10) {
        // Reduce absolute score by 20%
        return baseScore * 0.8;
    }
    return baseScore;
}

module.exports = {
    getEvalState,
    saveEvalState,
    detectZbcnRegime,
    evaluateSignalOutcome,
    applyZbcnLearningPenalty
};
