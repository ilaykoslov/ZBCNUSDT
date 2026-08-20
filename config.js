// =====================================================
// ZBCNUSDT & PROSUSDT Sinyal Dashboard - Merkezi Yapılandırma
// =====================================================
// Bu dosya tüm ayarları tek merkezde toplar.
// Threshold'ları, ağırlıkları ve API ayarlarını
// değiştirmek için bu dosyayı düzenleyin.
// =====================================================

const config = {
    // === SUNUCU AYARLARI ===
    server: {
        port: 3456,
        host: '0.0.0.0'
    },

    // === AKTİF SEMBOL (varsayılan) ===
    activeSymbol: process.env.ACTIVE_SYMBOL || 'ZBCNUSDT', // 'ZBCNUSDT', 'PROSUSDT', 'WLFIUSDT', 'SOLUSDT'

    // === API AYARLARI ===
    api: {
        kucoinBase: 'https://api.kucoin.com/api/v1',
        coingeckoBase: 'https://api.coingecko.com/api/v3',
        timeout: 15000,      // ms
        maxCandles: 100,
        retryAttempts: 2     // API başarısız olursa tekrar dene
    },

    // === SEMBOLLER ===
    symbols: {
        'ZBCNUSDT': {
            kucoinSymbol: 'ZBCN-USDT',
            coingeckoId: 'zebec-network',
            label: 'ZBCN / USDT',
            coinName: 'Zebec Network',
            paperTradingStateFile: './data/paperTrading_ZBCNUSDT.json',
            paperTradingInitialBalance: 10000
        },
        'PROSUSDT': {
            kucoinSymbol: 'PROS-USDT',
            coingeckoId: 'pharos-network',
            label: 'PROS / USDT',
            coinName: 'Prosper',
            paperTradingStateFile: './data/paperTrading_PROSUSDT.json',
            paperTradingInitialBalance: 5000,
            // PROS: düşük volatilite, range/reversal ağırlıklı profil
            specialSettings: {
                signalThresholds: { buy: 14, sell: -14 },
                categoryWeights: { trend: 25, momentum: 25, volatility: 20, volume: 20, structure: 10 },
                timeframes: { '1h': { weight: 45 }, '15m': { weight: 25 }, '4h': { weight: 30 } },
                confidence: { baseBuy: 60, baseSell: 60, minConfidence: 35, maxConfidence: 95 },
                indicators: { rsi: { period: 14 }, adx: { period: 14 }, atr: { period: 14 } }
            }
        },
        'WLFIUSDT': {
            kucoinSymbol: 'WLFI-USDT',
            coingeckoId: 'wlfi',
            label: 'WLFI / USDT',
            coinName: 'WLFI',
            paperTradingStateFile: './data/paperTrading_WLFIUSDT.json',
            paperTradingInitialBalance: 5000,
            // WLFI: orta volatilite, momentum ve breakout doğrulama profili
            specialSettings: {
                signalThresholds: { buy: 13, sell: -13 },
                categoryWeights: { trend: 30, momentum: 30, volatility: 18, volume: 17, structure: 5 },
                timeframes: { '1h': { weight: 45 }, '15m': { weight: 25 }, '4h': { weight: 30 } },
                confidence: { baseBuy: 58, baseSell: 58, minConfidence: 35, maxConfidence: 96 },
                indicators: { rsi: { period: 14 }, adx: { period: 14 }, atr: { period: 14 } }
            }
        },
        'SOLUSDT': {
            kucoinSymbol: 'SOL-USDT',
            coingeckoId: 'solana',
            label: 'SOL / USDT',
            coinName: 'Solana',
            paperTradingStateFile: './data/paperTrading_SOLUSDT.json',
            paperTradingInitialBalance: 5000,
            // SOL için özel ayarlar
            // SOL: daha likit major coin, trend ve multi-timeframe doğrulama profili
            specialSettings: {
                signalThresholds: { buy: 15, sell: -15 },
                categoryWeights: { trend: 25, momentum: 30, volatility: 20, volume: 15, structure: 10 },
                timeframes: { '1h': { weight: 40 }, '15m': { weight: 35 }, '4h': { weight: 25 } },
                confidence: { baseBuy: 60, baseSell: 60, minConfidence: 30, maxConfidence: 98 },
                indicators: { rsi: { period: 10 }, adx: { period: 10 }, atr: { period: 10 } }
            }
        }
    },

    // === ZAMAN DİLİMLERİ ===
    timeframes: {
        '1h': { kucoinType: '1hour', weight: 50, label: '1 Saat' },
        '15m': { kucoinType: '15min', weight: 20, label: '15 Dakika' },
        '4h': { kucoinType: '4hour', weight: 30, label: '4 Saat' }
    },

    // === SİNYAL EŞİKLERİ ===
    signalThresholds: {
        buy: 12,      // >= 12 ise BUY
        sell: -12     // <= -12 ise SELL
    },

    // === KATEGORİ AĞIRLIKLARI (toplam 100 olmalı) ===
    categoryWeights: {
        trend: 30,
        momentum: 25,
        volatility: 15,
        volume: 15,
        structure: 15
    },

    // === GÜNCELLEME AYARLARI ===
    refresh: {
        dashboardMs: 15000,      // Dashboard yenileme (ms)
        dataStaleMs: 60000       // Veri bayat sayılma süresi (ms)
    },

    // === SİNYAL GEÇMİŞİ ===
    signalHistory: {
        enabled: true,
        maxEntries: 500,
        filePath: './data/signals.json'
    },

    // === GÖSTERGE AYARLARI ===
    indicators: {
        rsi: { period: 14 },
        macd: { fast: 12, slow: 26, signal: 9 },
        bollinger: { period: 20, stdDev: 2 },
        sma: { periods: [7, 25, 99] },
        atr: { period: 14 },
        stochRsi: { rsiPeriod: 14, stochPeriod: 14 },
        adx: { period: 14 }
    },

    // === GELİŞMİŞ AYARLAR ===
    advanced: {
        obvLookback: 5,
        divergenceWindow: 25,
        peakLookAround: 2,
        supportResistanceLookback: 5
    },

    // === GÜVEN PUANLARI ===
    confidence: {
        baseBuy: 55,
        baseSell: 55,
        baseNeutral: 45,
        maxConfidence: 95,
        minConfidence: 25,
        perPointScore: 0.5,
        tfAlignmentBonus: 15,
        fullAlignmentBonus: 15
    },

    // === PAPER TRADING AYARLARI ===
    paperTrading: {
        enabled: true,
        initialBalance: 10000, // USDT - varsayılan
        mode: 'paper',
        manualApproval: true,
        defaultMaxPositionSize: 0.1,
        defaultStopLossPct: 0.05,
        defaultTakeProfitPct: 0.10,
        feeRate: 0.001
    },

    // === RISK MANAGEMENT AYARLARI ===
    risk: {
        maxPositionSize: 0.1,
        maxDailyLoss: 0.05,
        maxOpenPositions: 3,
        defaultStopLoss: 0.05,
        defaultTakeProfit: 0.10,
        riskRewardRatio: 2.0,
        minConfidence: 60,
        volatilityAdjustment: true
    },

    // === VERİ DOĞRULAMA AYARLARI ===
    dataValidation: {
        maxGapSize: 3,
        minCandleCount: 30,
        timestampTolerance: 60000,
        priceTolerance: 0.01,
        fillGaps: false,
        gapFillMethod: 'linear'
    },

    // === RETRY AYARLARI ===
    retry: {
        maxRetries: 3,
        initialDelay: 1000,
        maxDelay: 30000,
        backoffMultiplier: 2,
        circuitBreakerThreshold: 5,
        circuitBreakerTimeout: 60000
    },

    // === ALERT AYARLARI ===
    alerts: {
        enabled: false,
        telegram: {
            enabled: false,
            token: '',
            chatId: ''
        },
        discord: {
            enabled: false,
            webhookUrl: ''
        },
        email: {
            enabled: false,
            to: '',
            smtp: {
                host: '',
                port: 587,
                from: ''
            }
        }
    }
};

module.exports = config;