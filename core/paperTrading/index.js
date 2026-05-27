// =====================================================
// Paper Trading Module
// =====================================================
// Simulates trading without real money
// Tracks portfolio, positions, P&L, and trade history
// =====================================================

const fs = require('fs');
const path = require('path');

class PaperTradingEngine {
    constructor(config = {}) {
        this.initialBalance = config.initialBalance || 10000; // USDT
        this.balance = this.initialBalance;
        this.positions = []; // Open positions
        this.tradeHistory = []; // Closed trades
        this.pendingOrders = []; // Orders awaiting manual approval
        this.mode = config.mode || 'paper'; // 'paper' or 'live'
        this.manualApproval = config.manualApproval !== false; // Default true for live trading
        this.maxPositionSize = config.maxPositionSize || 0.1; // Max 10% of balance per trade
        this.stopLossPct = config.stopLossPct || 0.05; // 5% stop loss
        this.takeProfitPct = config.takeProfitPct || 0.10; // 10% take profit
        this.feeRate = config.feeRate || 0.001; // 0.1% trading fee
        
        // Load state from file if exists
        this.stateFile = config.stateFile || './data/paperTradingState.json';
        this.loadState();
    }

    // Save state to file
    saveState() {
        try {
            const dir = path.dirname(this.stateFile);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            const state = {
                balance: this.balance,
                positions: this.positions,
                tradeHistory: this.tradeHistory,
                pendingOrders: this.pendingOrders,
                timestamp: Date.now()
            };
            fs.writeFileSync(this.stateFile, JSON.stringify(state, null, 2));
        } catch (e) {
            console.error('Paper trading state save error:', e.message);
        }
    }

    // Load state from file
    loadState() {
        try {
            if (fs.existsSync(this.stateFile)) {
                const state = JSON.parse(fs.readFileSync(this.stateFile, 'utf8'));
                this.balance = state.balance || this.initialBalance;
                this.positions = state.positions || [];
                this.tradeHistory = state.tradeHistory || [];
                this.pendingOrders = state.pendingOrders || [];
                console.log('Paper trading state loaded');
            }
        } catch (e) {
            console.log('Paper trading state load error (using defaults):', e.message);
        }
    }

    // Calculate position size based on risk
    calculatePositionSize(entryPrice, signalConfidence) {
        const riskAmount = this.balance * this.maxPositionSize;
        const confidenceMultiplier = signalConfidence / 100;
        const positionSize = riskAmount * confidenceMultiplier;
        const quantity = positionSize / entryPrice;
        
        return {
            usdtAmount: positionSize,
            quantity: quantity,
            percentage: (positionSize / this.balance) * 100
        };
    }

    // Execute a trade (LONG or SHORT)
    executeTrade(signal, price, confidence, metadata = {}) {
        const trade = {
            id: this.generateTradeId(),
            type: signal, // 'BUY' or 'SELL'
            entryPrice: price,
            quantity: 0,
            usdtAmount: 0,
            confidence: confidence,
            timestamp: Date.now(),
            status: 'pending', // pending, open, closed
            metadata: metadata
        };

        // Calculate position size
        const positionSize = this.calculatePositionSize(price, confidence);
        trade.quantity = positionSize.quantity;
        trade.usdtAmount = positionSize.usdtAmount;

        // Check if we have enough balance
        if (signal === 'BUY' && trade.usdtAmount > this.balance) {
            return { success: false, error: 'Insufficient balance' };
        }

        // For paper trading, execute immediately
        if (this.mode === 'paper') {
            return this._executePaperTrade(trade);
        }

        // For live trading, require manual approval
        if (this.mode === 'live' && this.manualApproval) {
            this.pendingOrders.push(trade);
            this.saveState();
            return { 
                success: true, 
                status: 'pending_approval',
                message: 'Trade awaiting manual approval',
                tradeId: trade.id
            };
        }

        // Live trading without manual approval (DANGEROUS - should be avoided)
        return this._executePaperTrade(trade);
    }

    // Internal paper trade execution
    _executePaperTrade(trade) {
        const fee = trade.usdtAmount * this.feeRate;
        
        if (trade.type === 'BUY') {
            // Open LONG position
            this.balance -= trade.usdtAmount + fee;
            this.positions.push({
                ...trade,
                status: 'open',
                entryFee: fee,
                stopLoss: trade.entryPrice * (1 - this.stopLossPct),
                takeProfit: trade.entryPrice * (1 + this.takeProfitPct)
            });
        } else if (trade.type === 'SELL') {
            // Open SHORT position (simulated as negative quantity)
            this.balance -= fee; // Only pay fee for opening
            this.positions.push({
                ...trade,
                status: 'open',
                entryFee: fee,
                stopLoss: trade.entryPrice * (1 + this.stopLossPct),
                takeProfit: trade.entryPrice * (1 - this.takeProfitPct)
            });
        }

        this.saveState();
        return { success: true, status: 'executed', tradeId: trade.id };
    }

    // Approve a pending trade
    approveTrade(tradeId) {
        const index = this.pendingOrders.findIndex(t => t.id === tradeId);
        if (index === -1) {
            return { success: false, error: 'Trade not found' };
        }

        const trade = this.pendingOrders.splice(index, 1)[0];
        const result = this._executePaperTrade(trade);
        this.saveState();
        return result;
    }

    // Reject a pending trade
    rejectTrade(tradeId) {
        const index = this.pendingOrders.findIndex(t => t.id === tradeId);
        if (index === -1) {
            return { success: false, error: 'Trade not found' };
        }

        this.pendingOrders.splice(index, 1);
        this.saveState();
        return { success: true, status: 'rejected' };
    }

    // Close a position
    closePosition(positionId, currentPrice, reason = 'manual') {
        const index = this.positions.findIndex(p => p.id === positionId);
        if (index === -1) {
            return { success: false, error: 'Position not found' };
        }

        const position = this.positions[index];
        const exitPrice = currentPrice;
        const fee = position.usdtAmount * this.feeRate;

        let pnl = 0;
        let pnlPct = 0;

        if (position.type === 'BUY') {
            // Close LONG
            const exitValue = position.quantity * exitPrice;
            pnl = exitValue - position.usdtAmount - fee - position.entryFee;
            pnlPct = (pnl / position.usdtAmount) * 100;
            this.balance += exitValue - fee;
        } else {
            // Close SHORT
            const entryValue = position.usdtAmount;
            const exitValue = position.quantity * exitPrice;
            pnl = entryValue - exitValue - fee - position.entryFee;
            pnlPct = (pnl / position.usdtAmount) * 100;
            this.balance += position.usdtAmount + pnl; // Return original + profit/loss
        }

        // Move to trade history
        const closedTrade = {
            ...position,
            exitPrice: exitPrice,
            exitFee: fee,
            pnl: pnl,
            pnlPct: pnlPct,
            exitTimestamp: Date.now(),
            exitReason: reason,
            status: 'closed',
            duration: Date.now() - position.timestamp
        };

        this.positions.splice(index, 1);
        this.tradeHistory.push(closedTrade);
        this.saveState();

        return { 
            success: true, 
            pnl: pnl, 
            pnlPct: pnlPct,
            balance: this.balance 
        };
    }

    // Check stop-loss and take-profit for all positions
    checkStopLossTakeProfit(currentPrice) {
        const toClose = [];

        for (const position of this.positions) {
            if (position.type === 'BUY') {
                // LONG position
                if (currentPrice <= position.stopLoss) {
                    toClose.push({ positionId: position.id, reason: 'stop_loss' });
                } else if (currentPrice >= position.takeProfit) {
                    toClose.push({ positionId: position.id, reason: 'take_profit' });
                }
            } else {
                // SHORT position
                if (currentPrice >= position.stopLoss) {
                    toClose.push({ positionId: position.id, reason: 'stop_loss' });
                } else if (currentPrice <= position.takeProfit) {
                    toClose.push({ positionId: position.id, reason: 'take_profit' });
                }
            }
        }

        // Close positions that hit SL/TP
        const results = [];
        for (const close of toClose) {
            const result = this.closePosition(close.positionId, currentPrice, close.reason);
            results.push({ ...close, result });
        }

        return results;
    }

    // Get portfolio summary
    getPortfolioSummary() {
        const openPositionsValue = this.positions.reduce((sum, p) => {
            if (p.type === 'BUY') {
                return sum + p.usdtAmount;
            }
            return sum + p.usdtAmount; // Simplified for shorts
        }, 0);

        const realizedPnl = this.tradeHistory.reduce((sum, t) => sum + t.pnl, 0);
        const totalTrades = this.tradeHistory.length;
        const winningTrades = this.tradeHistory.filter(t => t.pnl > 0).length;
        const losingTrades = this.tradeHistory.filter(t => t.pnl < 0).length;
        const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

        return {
            balance: this.balance,
            initialBalance: this.initialBalance,
            totalReturn: ((this.balance - this.initialBalance) / this.initialBalance) * 100,
            openPositions: this.positions.length,
            openPositionsValue: openPositionsValue,
            pendingOrders: this.pendingOrders.length,
            realizedPnl: realizedPnl,
            totalTrades: totalTrades,
            winningTrades: winningTrades,
            losingTrades: losingTrades,
            winRate: winRate,
            mode: this.mode,
            manualApproval: this.manualApproval
        };
    }

    // Get open positions
    getOpenPositions() {
        return this.positions;
    }

    // Get pending orders
    getPendingOrders() {
        return this.pendingOrders;
    }

    // Get trade history
    getTradeHistory(limit = 50) {
        return this.tradeHistory.slice(-limit).reverse();
    }

    // Reset paper trading (clear all data)
    reset() {
        this.balance = this.initialBalance;
        this.positions = [];
        this.tradeHistory = [];
        this.pendingOrders = [];
        this.saveState();
        return { success: true, message: 'Paper trading reset' };
    }

    // Generate unique trade ID
    generateTradeId() {
        return 'TRD_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // Set trading mode
    setMode(mode) {
        if (mode === 'paper' || mode === 'live') {
            this.mode = mode;
            this.saveState();
            return { success: true, mode: this.mode };
        }
        return { success: false, error: 'Invalid mode' };
    }

    // Set manual approval
    setManualApproval(enabled) {
        this.manualApproval = enabled;
        this.saveState();
        return { success: true, manualApproval: this.manualApproval };
    }
}

module.exports = PaperTradingEngine;
