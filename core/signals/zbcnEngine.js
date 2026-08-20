// Backward-compatible ZBCN adapter.
// Yeni ortak motor: ./symbolEngine.js
const symbolEngine = require('./symbolEngine');

const SYMBOL = 'ZBCNUSDT';

module.exports = {
    getEvalState: () => symbolEngine.getEvalState(SYMBOL),
    saveEvalState: (state) => symbolEngine.saveEvalState(SYMBOL, state),
    detectZbcnRegime: (atrPct, adxValue) => symbolEngine.detectSymbolRegime(SYMBOL, atrPct, adxValue),
    evaluateSignalOutcome: (signalEntry, futureCandles, currentAtrPct) =>
        symbolEngine.evaluateSignalOutcome(SYMBOL, signalEntry, futureCandles, currentAtrPct),
    applyZbcnLearningPenalty: (baseScore, evalState, baseWeights) =>
        symbolEngine.applyLearningPenalty(baseScore, evalState, baseWeights).score,
    analyzeZbcnMicrostructure: (orderbook) => symbolEngine.analyzeMicrostructure(SYMBOL, orderbook),
    isZbcnInCooldown: symbolEngine.isSymbolInCooldown
};
