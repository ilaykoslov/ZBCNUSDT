// =====================================================
// Core Modülleri - Merkezi İçe Aktarma
// =====================================================

const indicators = require('./indicators');
const signals = require('./signals');
const backtest = require('./backtest');
const PaperTradingEngine = require('./paperTrading');
const RiskManager = require('./risk');
const DataValidator = require('./data');

module.exports = {
    indicators,
    signals,
    backtest,
    PaperTradingEngine,
    RiskManager,
    DataValidator
};