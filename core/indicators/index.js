// =====================================================
// İndikatör Modülleri - Merkezi İçe Aktarma
// =====================================================

const calculateIchimoku = require('./ichimoku').calculateIchimoku;
const getIchimokuSignal = require('./ichimoku').getIchimokuSignal;

const calculateWilliamsR = require('./williamsR').calculateWilliamsR;
const getWilliamsRSignal = require('./williamsR').getWilliamsRSignal;

const calculateCCI = require('./cci').calculateCCI;
const getCciSignal = require('./cci').getCciSignal;

const calculateVWAP = require('./vwap').calculateVWAP;
const getVwapSignal = require('./vwap').getVwapSignal;

const calculateVolumeProfile = require('./volumeProfile').calculateVolumeProfile;
const getVolumeProfileSignal = require('./volumeProfile').getVolumeProfileSignal;

const calculateKeltnerChannels = require('./keltner').calculateKeltnerChannels;
const getKeltnerSignal = require('./keltner').getKeltnerSignal;

const calculateSupertrend = require('./supertrend').calculateSupertrend;
const getSupertrendSignal = require('./supertrend').getSupertrendSignal;

module.exports = {
    calculateIchimoku,
    getIchimokuSignal,
    calculateWilliamsR,
    getWilliamsRSignal,
    calculateCCI,
    getCciSignal,
    calculateVWAP,
    getVwapSignal,
    calculateVolumeProfile,
    getVolumeProfileSignal,
    calculateKeltnerChannels,
    getKeltnerSignal,
    calculateSupertrend,
    getSupertrendSignal
};