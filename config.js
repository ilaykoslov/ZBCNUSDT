// =====================================================
// ZBCNUSDT Sinyal Dashboard - Merkezi Yapılandırma
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

    // === API AYARLARI ===
    api: {
        kucoinBase: 'https://api.kucoin.com/api/v1',
        coingeckoBase: 'https://api.coingecko.com/api/v3',
        symbol: 'ZBCN-USDT',
        coingeckoId: 'zebec-network',
        timeout: 15000,      // ms
        maxCandles: 100,
        retryAttempts: 2     // API başarısız olursa tekrar dene
    },

    // === ZAMAN DİLİMLERİ ===
    timeframes: {
        '1h': { kucoinType: '1hour', weight: 50, label: '1 Saat' },
        '15m': { kucoinType: '15min', weight: 20, label: '15 Dakika' },
        '4h': { kucoinType: '4hour', weight: 30, label: '4 Saat' }
    },

    // === SİNYAL EŞİKLERİ ===
    // weightedScore bu değerlerin üstünde/altında ise sinyal üretilir
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
        obvLookback: 5,           // OBV eğimi için mum sayısı
        divergenceWindow: 25,     // Uzlaşmazlık tespit penceresi
        peakLookAround: 2,        // Tepe/dip tespit hassasiyeti
        supportResistanceLookback: 5  // Destek/direnç geri bakış
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
    }
};

module.exports = config;
