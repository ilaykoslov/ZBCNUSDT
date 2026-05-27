// =====================================================
// Risk Management Module
// =====================================================
// Position sizing, stop-loss, take-profit, and risk controls
// =====================================================

class RiskManager {
    constructor(config = {}) {
        this.maxPositionSize = config.maxPositionSize || 0.1; // Max 10% of balance per trade
        this.maxDailyLoss = config.maxDailyLoss || 0.05; // Max 5% daily loss
        this.maxOpenPositions = config.maxOpenPositions || 3; // Max concurrent positions
        this.defaultStopLoss = config.defaultStopLoss || 0.05; // 5% default stop loss
        this.defaultTakeProfit = config.defaultTakeProfit || 0.10; // 10% default take profit
        this.riskRewardRatio = config.riskRewardRatio || 2.0; // Minimum 2:1 risk/reward
        this.minConfidence = config.minConfidence || 60; // Minimum confidence to trade
        this.volatilityAdjustment = config.volatilityAdjustment || true; // Adjust SL/TP based on volatility
        
        this.dailyPnl = 0;
        this.dailyTrades = 0;
        this.lastResetDate = new Date().toDateString();
    }

    // Reset daily counters
    resetDailyCounters() {
        const today = new Date().toDateString();
        if (today !== this.lastResetDate) {
            this.dailyPnl = 0;
            this.dailyTrades = 0;
            this.lastResetDate = today;
        }
    }

    // Calculate position size based on risk
    calculatePositionSize(balance, entryPrice, stopLossPrice, confidence = 70) {
        this.resetDailyCounters();

        // Check daily loss limit
        if (this.dailyPnl < -balance * this.maxDailyLoss) {
            return { 
                success: false, 
                error: 'Daily loss limit reached',
                dailyPnl: this.dailyPnl,
                dailyLimit: -balance * this.maxDailyLoss
            };
        }

        // Check minimum confidence
        if (confidence < this.minConfidence) {
            return { 
                success: false, 
                error: 'Confidence below minimum',
                confidence: confidence,
                minConfidence: this.minConfidence
            };
        }

        // Calculate risk amount (1% of balance or max position size, whichever is smaller)
        const riskAmount = Math.min(balance * 0.01, balance * this.maxPositionSize);
        
        // Adjust risk based on confidence (higher confidence = slightly larger position)
        const confidenceMultiplier = 0.5 + (confidence / 100) * 0.5; // 0.5 to 1.0
        const adjustedRiskAmount = riskAmount * confidenceMultiplier;

        // Calculate position size
        const riskPerUnit = Math.abs(entryPrice - stopLossPrice);
        if (riskPerUnit === 0) {
            return { success: false, error: 'Invalid stop loss price' };
        }

        const quantity = adjustedRiskAmount / riskPerUnit;
        const positionValue = quantity * entryPrice;

        // Check if position exceeds max position size
        if (positionValue > balance * this.maxPositionSize) {
            return { 
                success: false, 
                error: 'Position size exceeds maximum',
                positionValue: positionValue,
                maxValue: balance * this.maxPositionSize
            };
        }

        return {
            success: true,
            quantity: quantity,
            positionValue: positionValue,
            riskAmount: adjustedRiskAmount,
            percentage: (positionValue / balance) * 100
        };
    }

    // Calculate optimal stop-loss based on ATR
    calculateATRStopLoss(entryPrice, atr, multiplier = 2.0, isLong = true) {
        const slDistance = atr * multiplier;
        return isLong ? entryPrice - slDistance : entryPrice + slDistance;
    }

    // Calculate take-profit based on stop-loss and risk/reward ratio
    calculateTakeProfit(entryPrice, stopLoss, riskRewardRatio = null, isLong = true) {
        const rr = riskRewardRatio || this.riskRewardRatio;
        const riskDistance = Math.abs(entryPrice - stopLoss);
        const rewardDistance = riskDistance * rr;
        return isLong ? entryPrice + rewardDistance : entryPrice - rewardDistance;
    }

    // Validate trade setup
    validateTradeSetup(signal, entryPrice, stopLoss, takeProfit, confidence, currentPositions) {
        const errors = [];
        const warnings = [];

        // Check signal
        if (signal !== 'BUY' && signal !== 'SELL') {
            errors.push('Invalid signal type');
        }

        // Check prices
        if (entryPrice <= 0) {
            errors.push('Invalid entry price');
        }
        if (stopLoss <= 0) {
            errors.push('Invalid stop loss');
        }
        if (takeProfit <= 0) {
            errors.push('Invalid take profit');
        }

        // Check stop-loss and take-profit logic
        if (signal === 'BUY') {
            if (stopLoss >= entryPrice) {
                errors.push('Stop loss must be below entry for LONG');
            }
            if (takeProfit <= entryPrice) {
                errors.push('Take profit must be above entry for LONG');
            }
        } else {
            if (stopLoss <= entryPrice) {
                errors.push('Stop loss must be above entry for SHORT');
            }
            if (takeProfit >= entryPrice) {
                errors.push('Take profit must be below entry for SHORT');
            }
        }

        // Check risk/reward ratio
        const riskDistance = Math.abs(entryPrice - stopLoss);
        const rewardDistance = Math.abs(takeProfit - entryPrice);
        const actualRR = rewardDistance / riskDistance;
        if (actualRR < this.riskRewardRatio) {
            warnings.push(`Risk/reward ratio (${actualRR.toFixed(2)}) below minimum (${this.riskRewardRatio})`);
        }

        // Check confidence
        if (confidence < this.minConfidence) {
            warnings.push(`Confidence (${confidence}%) below minimum (${this.minConfidence}%)`);
        }

        // Check max open positions
        if (currentPositions >= this.maxOpenPositions) {
            errors.push(`Maximum open positions (${this.maxOpenPositions}) reached`);
        }

        return {
            valid: errors.length === 0,
            errors: errors,
            warnings: warnings,
            riskRewardRatio: actualRR
        };
    }

    // Calculate dynamic stop-loss based on volatility
    calculateVolatilityAdjustedStopLoss(entryPrice, volatility, isLong = true) {
        // Higher volatility = wider stop loss
        const baseStopLoss = this.defaultStopLoss;
        const volatilityMultiplier = Math.min(3.0, Math.max(1.0, volatility * 10));
        const adjustedStopLoss = baseStopLoss * volatilityMultiplier;
        
        return isLong 
            ? entryPrice * (1 - adjustedStopLoss)
            : entryPrice * (1 + adjustedStopLoss);
    }

    // Calculate position size using Kelly Criterion (simplified)
    calculateKellyPositionSize(balance, winRate, avgWin, avgLoss) {
        if (avgLoss === 0) return { success: false, error: 'Average loss is zero' };
        
        const kellyFraction = (winRate * avgWin - (1 - winRate) * avgLoss) / avgWin;
        
        // Cap Kelly fraction at 25% to avoid over-leveraging
        const cappedKelly = Math.min(0.25, Math.max(0, kellyFraction));
        
        return {
            success: true,
            kellyFraction: kellyFraction,
            cappedKellyFraction: cappedKelly,
            positionValue: balance * cappedKelly,
            percentage: cappedKelly * 100
        };
    }

    // Check if trade should be skipped based on market conditions
    shouldSkipTrade(marketRegime, volatility, spread) {
        const reasons = [];

        // Skip in choppy markets
        if (marketRegime === 'Chop') {
            reasons.push('Choppy market conditions');
        }

        // Skip if volatility is too low (no movement) or too high (too risky)
        if (volatility < 0.01) {
            reasons.push('Volatility too low');
        }
        if (volatility > 0.10) {
            reasons.push('Volatility too high');
        }

        // Skip if spread is too wide
        if (spread > 0.01) { // 1% spread
            reasons.push('Spread too wide');
        }

        return {
            shouldSkip: reasons.length > 0,
            reasons: reasons
        };
    }

    // Update daily P&L
    updateDailyPnl(pnl) {
        this.resetDailyCounters();
        this.dailyPnl += pnl;
        this.dailyTrades++;
    }

    // Get daily statistics
    getDailyStats() {
        this.resetDailyCounters();
        return {
            dailyPnl: this.dailyPnl,
            dailyTrades: this.dailyTrades,
            lastResetDate: this.lastResetDate
        };
    }

    // Check if trading should be paused
    shouldPauseTrading(balance) {
        this.resetDailyCounters();

        // Pause if daily loss limit reached
        if (this.dailyPnl < -balance * this.maxDailyLoss) {
            return {
                shouldPause: true,
                reason: 'Daily loss limit reached',
                dailyPnl: this.dailyPnl,
                limit: -balance * this.maxDailyLoss
            };
        }

        return {
            shouldPause: false,
            reason: null
        };
    }

    // Calculate trailing stop loss
    calculateTrailingStopLoss(entryPrice, currentPrice, highestPrice, trailPercent = 0.02, isLong = true) {
        if (isLong) {
            const trailDistance = currentPrice * trailPercent;
            const newStopLoss = currentPrice - trailDistance;
            // Only move stop loss up, never down
            return Math.max(entryPrice * (1 - this.defaultStopLoss), newStopLoss);
        } else {
            const trailDistance = currentPrice * trailPercent;
            const newStopLoss = currentPrice + trailDistance;
            // Only move stop loss down, never up
            return Math.min(entryPrice * (1 + this.defaultStopLoss), newStopLoss);
        }
    }

    // Get risk parameters
    getRiskParameters() {
        return {
            maxPositionSize: this.maxPositionSize,
            maxDailyLoss: this.maxDailyLoss,
            maxOpenPositions: this.maxOpenPositions,
            defaultStopLoss: this.defaultStopLoss,
            defaultTakeProfit: this.defaultTakeProfit,
            riskRewardRatio: this.riskRewardRatio,
            minConfidence: this.minConfidence,
            volatilityAdjustment: this.volatilityAdjustment
        };
    }

    // Update risk parameters
    updateRiskParameters(params) {
        if (params.maxPositionSize !== undefined) this.maxPositionSize = params.maxPositionSize;
        if (params.maxDailyLoss !== undefined) this.maxDailyLoss = params.maxDailyLoss;
        if (params.maxOpenPositions !== undefined) this.maxOpenPositions = params.maxOpenPositions;
        if (params.defaultStopLoss !== undefined) this.defaultStopLoss = params.defaultStopLoss;
        if (params.defaultTakeProfit !== undefined) this.defaultTakeProfit = params.defaultTakeProfit;
        if (params.riskRewardRatio !== undefined) this.riskRewardRatio = params.riskRewardRatio;
        if (params.minConfidence !== undefined) this.minConfidence = params.minConfidence;
        if (params.volatilityAdjustment !== undefined) this.volatilityAdjustment = params.volatilityAdjustment;

        return { success: true, parameters: this.getRiskParameters() };
    }
}

module.exports = RiskManager;
