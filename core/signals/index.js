// =====================================================
// Sinyal Modülleri - Merkezi İçe Aktarma
// =====================================================

const analyzeConfluence = require('./confluence').analyzeConfluence;
const detectMarketRegime = require('./confluence').detectMarketRegime;
const getRegimeWeights = require('./confluence').getRegimeWeights;
const calculateTradeGrade = require('./confluence').calculateTradeGrade;
const symbolEngine = require('./symbolEngine');

module.exports = {
    analyzeConfluence,
    detectMarketRegime,
    getRegimeWeights,
    calculateTradeGrade,
    symbolEngine
};