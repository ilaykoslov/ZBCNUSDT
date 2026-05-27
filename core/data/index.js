// =====================================================
// Data Validation and Gap Detection Module
// =====================================================
// Validates candle data, detects gaps, normalizes timestamps
// =====================================================

class DataValidator {
    constructor(config = {}) {
        this.maxGapSize = config.maxGapSize || 3; // Max 3 missing candles allowed
        this.minCandleCount = config.minCandleCount || 30; // Minimum candles for analysis
        this.timestampTolerance = config.timestampTolerance || 60000; // 1 minute tolerance
        this.priceTolerance = config.priceTolerance || 0.01; // 1% price tolerance
    }

    // Validate candle data structure
    validateCandleData(candles, timeframe = '1h') {
        const errors = [];
        const warnings = [];

        if (!Array.isArray(candles)) {
            errors.push('Candles must be an array');
            return { valid: false, errors, warnings };
        }

        if (candles.length < this.minCandleCount) {
            errors.push(`Insufficient candles: ${candles.length} (minimum ${this.minCandleCount})`);
        }

        // Expected interval in milliseconds based on timeframe
        const expectedInterval = this.getTimeframeInterval(timeframe);

        for (let i = 0; i < candles.length; i++) {
            const candle = candles[i];

            // Check required fields
            if (!candle.time || candle.time === null) {
                errors.push(`Candle ${i}: missing time`);
            }
            if (candle.open === null || candle.open === undefined) {
                errors.push(`Candle ${i}: missing open`);
            }
            if (candle.close === null || candle.close === undefined) {
                errors.push(`Candle ${i}: missing close`);
            }
            if (candle.high === null || candle.high === undefined) {
                errors.push(`Candle ${i}: missing high`);
            }
            if (candle.low === null || candle.low === undefined) {
                errors.push(`Candle ${i}: missing low`);
            }
            if (candle.volume === null || candle.volume === undefined) {
                errors.push(`Candle ${i}: missing volume`);
            }

            // Check price logic
            if (candle.high < candle.low) {
                errors.push(`Candle ${i}: high (${candle.high}) < low (${candle.low})`);
            }
            if (candle.open < candle.low || candle.open > candle.high) {
                errors.push(`Candle ${i}: open (${candle.open}) outside high-low range`);
            }
            if (candle.close < candle.low || candle.close > candle.high) {
                errors.push(`Candle ${i}: close (${candle.close}) outside high-low range`);
            }

            // Check for negative values
            if (candle.open < 0 || candle.close < 0 || candle.high < 0 || candle.low < 0) {
                errors.push(`Candle ${i}: negative price detected`);
            }
            if (candle.volume < 0) {
                errors.push(`Candle ${i}: negative volume detected`);
            }

            // Check for zero values
            if (candle.open === 0 || candle.close === 0 || candle.high === 0 || candle.low === 0) {
                warnings.push(`Candle ${i}: zero price detected`);
            }

            // Check timestamp gaps
            if (i > 0 && candles[i - 1].time) {
                const prevTime = candles[i - 1].time;
                const currTime = candle.time;
                const gap = currTime - prevTime;
                
                if (gap > expectedInterval * (this.maxGapSize + 1)) {
                    const missingCandles = Math.round(gap / expectedInterval) - 1;
                    warnings.push(`Candle ${i}: gap detected - ${missingCandles} missing candles`);
                }
            }
        }

        return {
            valid: errors.length === 0,
            errors: errors,
            warnings: warnings,
            candleCount: candles.length
        };
    }

    // Detect gaps in candle data
    detectGaps(candles, timeframe = '1h') {
        const gaps = [];
        const expectedInterval = this.getTimeframeInterval(timeframe);

        for (let i = 1; i < candles.length; i++) {
            const prevTime = candles[i - 1].time;
            const currTime = candles[i].time;
            const gap = currTime - prevTime;

            if (gap > expectedInterval * 1.5) {
                const missingCandles = Math.round(gap / expectedInterval) - 1;
                gaps.push({
                    index: i,
                    prevTime: prevTime,
                    currTime: currTime,
                    gapSize: gap,
                    missingCandles: missingCandles,
                    severity: missingCandles > this.maxGapSize ? 'critical' : 'warning'
                });
            }
        }

        return {
            hasGaps: gaps.length > 0,
            gaps: gaps,
            totalMissing: gaps.reduce((sum, g) => sum + g.missingCandles, 0)
        };
    }

    // Normalize timestamps to milliseconds
    normalizeTimestamps(candles, inputFormat = 'seconds') {
        return candles.map(candle => {
            const normalized = { ...candle };
            
            if (inputFormat === 'seconds') {
                normalized.time = candle.time * 1000;
            } else if (inputFormat === 'milliseconds') {
                normalized.time = candle.time;
            } else {
                // Auto-detect
                normalized.time = candle.time < 10000000000 ? candle.time * 1000 : candle.time;
            }

            return normalized;
        });
    }

    // Sort candles by timestamp
    sortCandles(candles, ascending = true) {
        return [...candles].sort((a, b) => {
            return ascending ? a.time - b.time : b.time - a.time;
        });
    }

    // Remove duplicate candles
    removeDuplicates(candles) {
        const seen = new Set();
        const unique = [];

        for (const candle of candles) {
            const key = candle.time.toString();
            if (!seen.has(key)) {
                seen.add(key);
                unique.push(candle);
            }
        }

        return unique;
    }

    // Fill gaps with interpolated candles (optional)
    fillGaps(candles, timeframe = '1h', method = 'linear') {
        const gaps = this.detectGaps(candles, timeframe);
        if (!gaps.hasGaps) {
            return candles;
        }

        const filled = [...candles];
        const expectedInterval = this.getTimeframeInterval(timeframe);

        for (const gap of gaps.gaps) {
            if (gap.severity === 'critical') {
                // Don't fill critical gaps
                continue;
            }

            const prevCandle = candles[gap.index - 1];
            const nextCandle = candles[gap.index];

            for (let i = 1; i <= gap.missingCandles; i++) {
                const time = prevCandle.time + (expectedInterval * i);
                const ratio = i / (gap.missingCandles + 1);

                let filledCandle;
                if (method === 'linear') {
                    filledCandle = {
                        time: time,
                        open: this.interpolate(prevCandle.open, nextCandle.open, ratio),
                        high: this.interpolate(prevCandle.high, nextCandle.high, ratio),
                        low: this.interpolate(prevCandle.low, nextCandle.low, ratio),
                        close: this.interpolate(prevCandle.close, nextCandle.close, ratio),
                        volume: this.interpolate(prevCandle.volume, nextCandle.volume, ratio),
                        filled: true
                    };
                } else {
                    // Forward fill (use previous candle values)
                    filledCandle = {
                        time: time,
                        open: prevCandle.close,
                        high: prevCandle.close,
                        low: prevCandle.close,
                        close: prevCandle.close,
                        volume: 0,
                        filled: true
                    };
                }

                filled.splice(gap.index + i - 1, 0, filledCandle);
            }
        }

        return filled;
    }

    // Interpolate between two values
    interpolate(val1, val2, ratio) {
        return val1 + (val2 - val1) * ratio;
    }

    // Get expected interval in milliseconds for a timeframe
    getTimeframeInterval(timeframe) {
        const intervals = {
            '1m': 60000,
            '5m': 300000,
            '15m': 900000,
            '30m': 1800000,
            '1h': 3600000,
            '4h': 14400000,
            '1d': 86400000,
            '1w': 604800000
        };
        return intervals[timeframe] || 3600000; // Default to 1h
    }

    // Validate ticker data
    validateTickerData(ticker) {
        const errors = [];
        const warnings = [];

        if (!ticker) {
            errors.push('Ticker data is null');
            return { valid: false, errors, warnings };
        }

        if (!ticker.last || ticker.last === null) {
            errors.push('Missing last price');
        }
        if (!ticker.changeRate && ticker.changeRate !== 0) {
            errors.push('Missing change rate');
        }
        if (!ticker.high || ticker.high === null) {
            errors.push('Missing high price');
        }
        if (!ticker.low || ticker.low === null) {
            errors.push('Missing low price');
        }
        if (!ticker.volValue && ticker.volValue !== 0) {
            errors.push('Missing volume');
        }

        // Check price logic
        if (ticker.high < ticker.low) {
            errors.push(`High (${ticker.high}) < Low (${ticker.low})`);
        }
        if (ticker.last < ticker.low || ticker.last > ticker.high) {
            warnings.push('Last price outside 24h range');
        }

        return {
            valid: errors.length === 0,
            errors: errors,
            warnings: warnings
        };
    }

    // Validate orderbook data
    validateOrderbookData(orderbook) {
        const errors = [];
        const warnings = [];

        if (!orderbook) {
            errors.push('Orderbook data is null');
            return { valid: false, errors, warnings };
        }

        if (!orderbook.bestBid || orderbook.bestBid === null) {
            errors.push('Missing best bid');
        }
        if (!orderbook.bestAsk || orderbook.bestAsk === null) {
            errors.push('Missing best ask');
        }

        // Check bid/ask logic
        if (orderbook.bestBid >= orderbook.bestAsk) {
            errors.push(`Bid (${orderbook.bestBid}) >= Ask (${orderbook.bestAsk})`);
        }

        // Check spread
        const spread = ((orderbook.bestAsk - orderbook.bestBid) / orderbook.bestAsk) * 100;
        if (spread > 1) {
            warnings.push(`Wide spread: ${spread.toFixed(2)}%`);
        }

        return {
            valid: errors.length === 0,
            errors: errors,
            warnings: warnings,
            spread: spread
        };
    }

    // Get data quality score (0-100)
    getDataQualityScore(validationResult) {
        let score = 100;

        // Deduct points for errors
        score -= validationResult.errors.length * 20;

        // Deduct points for warnings
        score -= validationResult.warnings.length * 5;

        return Math.max(0, score);
    }

    // Clean and normalize candle data
    cleanCandleData(candles, timeframe = '1h', fillGaps = false) {
        let cleaned = candles;

        // Normalize timestamps
        cleaned = this.normalizeTimestamps(cleaned);

        // Sort by time
        cleaned = this.sortCandles(cleaned);

        // Remove duplicates
        cleaned = this.removeDuplicates(cleaned);

        // Fill gaps if requested
        if (fillGaps) {
            cleaned = this.fillGaps(cleaned, timeframe);
        }

        return cleaned;
    }

    // Get data summary
    getDataSummary(candles) {
        if (!candles || candles.length === 0) {
            return { error: 'No data' };
        }

        const closes = candles.map(c => c.close);
        const volumes = candles.map(c => c.volume);

        return {
            candleCount: candles.length,
            timeRange: {
                start: new Date(candles[0].time).toISOString(),
                end: new Date(candles[candles.length - 1].time).toISOString()
            },
            priceRange: {
                low: Math.min(...candles.map(c => c.low)),
                high: Math.max(...candles.map(c => c.high)),
                current: closes[closes.length - 1]
            },
            volume: {
                total: volumes.reduce((sum, v) => sum + v, 0),
                average: volumes.reduce((sum, v) => sum + v, 0) / volumes.length
            }
        };
    }
}

module.exports = DataValidator;
