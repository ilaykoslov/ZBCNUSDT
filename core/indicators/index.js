// =====================================================
// İndikatör Modülleri - Merkezi İçe Aktarma
// =====================================================

const signalEngine = require('../signals/signalEngine');

module.exports = {
    // Temel indikatörler (signalEngine.js içinden)
    sma: signalEngine.sma,
    ema: signalEngine.ema,
    rsi: signalEngine.rsi,
    macd: signalEngine.macd,
    bollinger: signalEngine.bollinger,
    atr: signalEngine.atr,
    adx: signalEngine.adx,
    obv: signalEngine.obv,
    slope: signalEngine.slope,

    // Özel indikatörler
    calculateIchimoku: require('./ichimoku').calculateIchimoku,
    getIchimokuSignal: require('./ichimoku').getIchimokuSignal,
    calculateWilliamsR: require('./williamsR').calculateWilliamsR,
    getWilliamsRSignal: require('./williamsR').getWilliamsRSignal,
    calculateCCI: require('./cci').calculateCCI,
    getCciSignal: require('./cci').getCciSignal,
    calculateVWAP: require('./vwap').calculateVWAP,
    getVwapSignal: require('./vwap').getVwapSignal,
    calculateVolumeProfile: require('./volumeProfile').calculateVolumeProfile,
    getVolumeProfileSignal: require('./volumeProfile').getVolumeProfileSignal,
    calculateKeltnerChannels: require('./keltner').calculateKeltnerChannels,
    getKeltnerSignal: require('./keltner').getKeltnerSignal,
    calculateSupertrend: require('./supertrend').calculateSupertrend,
    getSupertrendSignal: require('./supertrend').getSupertrendSignal
};