// =====================================================
// Sinyal Modülleri - Merkezi İçe Aktarma
// =====================================================

const analyzeConfluence = require('./confluence').analyzeConfluence;
const detectMarketRegime = require('./confluence').detectMarketRegime;
const getRegimeWeights = require('./confluence').getRegimeWeights;
const calculateTradeGrade = require('./confluence').calculateTradeGrade;

module.exports = {
    analyzeConfluence,
    detectMarketRegime,
    getRegimeWeights,
    calculateTradeGrade
};