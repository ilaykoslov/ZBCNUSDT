// =====================================================
// Backtest Modülü
// =====================================================
// Historik veriler üzerinde strateji testi yapar
// =====================================================

function runBacktest(candles, strategyFn, initialBalance = 10000, positionSize = 0.1) {
    if (!candles || candles.length < 30) {
        return { error: 'Yetersiz veri' };
    }

    const results = {
        initialBalance,
        finalBalance: initialBalance,
        trades: [],
        wins: 0,
        losses: 0,
        winRate: 0,
        profitFactor: 0,
        maxDrawdown: 0,
        totalReturn: 0,
        tradesCount: 0
    };

    let balance = initialBalance;
    let position = null; // { entryPrice, type: 'long' | 'short', size }
    let peakBalance = initialBalance;

    for (let i = 30; i < candles.length; i++) {
        const currentCandle = candles[i];
        const historicalCandles = candles.slice(0, i + 1);

        // Strateji sinyali al
        const signal = strategyFn(historicalCandles, currentCandle);

        // Pozisyon kapatma
        if (position) {
            const pnlPct = position.type === 'long'
                ? (currentCandle.close - position.entryPrice) / position.entryPrice
                : (position.entryPrice - currentCandle.close) / position.entryPrice;

            const pnl = balance * positionSize * pnlPct;
            balance += pnl;

            if (pnl > 0) {
                results.wins++;
            } else {
                results.losses++;
            }

            results.trades.push({
                entryPrice: position.entryPrice,
                exitPrice: currentCandle.close,
                type: position.type,
                pnl,
                pnlPct: pnlPct * 100,
                entryTime: candles[i - 1].time,
                exitTime: currentCandle.time
            });

            position = null;
        }

        // Yeni pozisyon açma
        if (signal && signal.signal !== 'NEUTRAL') {
            position = {
                entryPrice: currentCandle.close,
                type: signal.signal === 'BUY' ? 'long' : 'short',
                size: positionSize
            };
        }

        // Max drawdown hesapla
        if (balance > peakBalance) {
            peakBalance = balance;
        }
        const drawdown = (peakBalance - balance) / peakBalance * 100;
        if (drawdown > results.maxDrawdown) {
            results.maxDrawdown = drawdown;
        }
    }

    // Sonuçları hesapla
    results.finalBalance = balance;
    results.tradesCount = results.trades.length;
    results.winRate = results.tradesCount > 0 ? (results.wins / results.tradesCount) * 100 : 0;
    results.totalReturn = ((balance - initialBalance) / initialBalance) * 100;

    // Profit factor (toplam kâr / toplam zarar)
    const totalProfit = results.trades
        .filter(t => t.pnl > 0)
        .reduce((sum, t) => sum + t.pnl, 0);
    const totalLoss = Math.abs(results.trades
        .filter(t => t.pnl < 0)
        .reduce((sum, t) => sum + t.pnl, 0));

    results.profitFactor = totalLoss > 0 ? totalProfit / totalLoss : 0;

    return results;
}

// Basit strateji örnekleri
const strategies = {
    // RSI-based strategy
    rsi: (candles, currentCandle, rsiPeriod = 14, overbought = 70, oversold = 30) => {
        const closes = candles.map(c => c.close);
        const rsiArr = calculateRSI(closes, rsiPeriod);
        const lastRsi = rsiArr[rsiArr.length - 1];

        if (lastRsi === null) return null;

        if (lastRsi < oversold) {
            return { signal: 'BUY', confidence: (oversold - lastRsi) / oversold * 100 };
        } else if (lastRsi > overbought) {
            return { signal: 'SELL', confidence: (lastRsi - overbought) / (100 - overbought) * 100 };
        }
        return { signal: 'NEUTRAL', confidence: 50 };
    },

    // SMA crossover strategy
    smaCrossover: (candles, currentCandle, fastPeriod = 7, slowPeriod = 25) => {
        const closes = candles.map(c => c.close);
        const smaFast = calculateSMA(closes, fastPeriod);
        const smaSlow = calculateSMA(closes, slowPeriod);

        const lastFast = smaFast[smaFast.length - 1];
        const prevFast = smaFast[smaFast.length - 2];
        const lastSlow = smaSlow[smaSlow.length - 1];
        const prevSlow = smaSlow[smaSlow.length - 2];

        if (lastFast === null || prevFast === null) return null;

        if (prevFast <= prevSlow && lastFast > lastSlow) {
            return { signal: 'BUY', confidence: 70 };
        } else if (prevFast >= prevSlow && lastFast < lastSlow) {
            return { signal: 'SELL', confidence: 70 };
        }
        return { signal: 'NEUTRAL', confidence: 50 };
    },

    // MACD strategy
    macd: (candles, currentCandle) => {
        const closes = candles.map(c => c.close);
        const macdResult = calculateMACD(closes);

        const macdLine = macdResult.macdLine[macdResult.macdLine.length - 1];
        const signalLine = macdResult.signalLine[macdResult.signalLine.length - 1];
        const histogram = macdResult.histogram[macdResult.histogram.length - 1];

        if (macdLine === null || signalLine === null) return null;

        if (macdLine > signalLine && histogram > 0) {
            return { signal: 'BUY', confidence: 75 };
        } else if (macdLine < signalLine && histogram < 0) {
            return { signal: 'SELL', confidence: 75 };
        }
        return { signal: 'NEUTRAL', confidence: 50 };
    }
};

// Helper functions
function calculateRSI(prices, period = 14) {
    if (prices.length < period + 1) return Array(prices.length).fill(null);
    const changes = [];
    for (let i = 1; i < prices.length; i++) changes.push(prices[i] - prices[i - 1]);
    const gains = changes.map(c => c > 0 ? c : 0);
    const losses = changes.map(c => c < 0 ? -c : 0);
    const rsi = [null];
    let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
    let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
    if (avgLoss === 0) rsi.push(100);
    else rsi.push(100 - (100 / (1 + avgGain / avgLoss)));
    for (let i = period; i < changes.length; i++) {
        avgGain = ((avgGain * (period - 1)) + gains[i]) / period;
        avgLoss = ((avgLoss * (period - 1)) + losses[i]) / period;
        if (avgLoss === 0) rsi.push(100);
        else rsi.push(100 - (100 / (1 + avgGain / avgLoss)));
    }
    return rsi;
}

function calculateSMA(data, period) {
    const result = [];
    for (let i = 0; i < data.length; i++) {
        if (i < period - 1) { result.push(null); continue; }
        let sum = 0;
        for (let j = i - period + 1; j <= i; j++) sum += data[j];
        result.push(sum / period);
    }
    return result;
}

function calculateMACD(prices) {
    const ema12 = calculateEMA(prices, 12);
    const ema26 = calculateEMA(prices, 26);
    const macdLine = [];
    for (let i = 0; i < prices.length; i++) macdLine.push((ema12[i] !== null && ema26[i] !== null) ? ema12[i] - ema26[i] : null);
    const signalLine = calculateEMA(macdLine, 9);
    const histogram = [];
    for (let i = 0; i < macdLine.length; i++) histogram.push((macdLine[i] !== null && signalLine[i] !== null) ? macdLine[i] - signalLine[i] : null);
    return { macdLine, signalLine, histogram };
}

function calculateEMA(data, period) {
    const result = []; const multiplier = 2 / (period + 1);
    let sum = 0, count = 0;
    for (let i = 0; i < data.length; i++) {
        if (data[i] === null) { result.push(null); continue; }
        if (count < period) { sum += data[i]; count++; result.push(count === period ? sum / period : null); }
        else result.push((data[i] - result[i - 1]) * multiplier + result[i - 1]);
    }
    return result;
}

module.exports = { runBacktest, strategies };