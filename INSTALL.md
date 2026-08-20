# ZBCNUSDT Trading System - Installation & Setup Guide

## 🚀 Quick Start

### 1. Repository Clone
```bash
git clone https://github.com/ilaykoslov/ZBCNUSDT.git
cd ZBCNUSDT
```

### 2. Installation
```bash
npm install
```

### 3. Environment Setup
```bash
cp .env.example .env
# Edit .env file with your API keys
```

### 4. Start Development Server
```bash
npm run dev:watch
```

## 🔧 Configuration

### API Keys Setup

**Required for live trading:**
```bash
# KuCoin API Keys (for real-time data)
export KUCOIN_API_KEY="your_key"
export KUCOIN_SECRET_KEY="your_secret" 
export KUCOIN_PASSPHRASE="your_passphrase"

# CoinGecko API Key (optional, for additional data)
export COINGECKO_API_KEY="your_key"
```

**Optional for alerts:**
```bash
# Telegram Alerts
export TELEGRAM_ENABLED=true
export TELEGRAM_TOKEN="your_bot_token"
export TELEGRAM_CHAT_ID="your_chat_id"

# Discord Alerts  
export DISCORD_ENABLED=true
export DISCORD_WEBHOOK_URL="your_webhook_url"
```

### Configuration Files

Edit `config.js` for:
- Signal thresholds (`signalThresholds`)
- Timeframe weights (`timeframes`)
- Category weights (`categoryWeights`)
- Risk parameters (`risk`)
- Indicator periods

## 🌐 Running the Application

### Development Mode
```bash
npm run dev:watch  # Auto-restart on changes
```

### Production Mode
```bash
npm start
```

### Testing
```bash
npm test           # Quick test
npm run test:full        # Comprehensive test
npm run test:integration  # API and paper-trading integration test
npm run test:all         # Run all test groups
npm run health           # Health check
```

## 📊 Dashboard Access

After starting the server:
```
http://localhost:3456
```

## 🔍 System Architecture

```
ZBCNUSDT/
├── server.js              # Express server & WebSocket
├── config.js              # System configuration
├── core/                  # Core trading logic
│   ├── signals/           # Signal generation
│   ├── indicators/        # Technical indicators
│   ├── risk/              # Risk management
│   └── data/              # Data validation
├── api/                   # External API integrations
├── utils/                 # Utility functions
├── data/                  # Signal history & logs
└── dashboard.html         # Frontend interface
```

## 🛡️ Security

### API Key Management
- Never commit API keys to repository
- Use environment variables only
- Regularly rotate API keys
- Enable IP whitelisting

### Network Security
- Allow specific origins in `ALLOWED_ORIGINS`
- Use HTTPS in production
- Implement rate limiting

## 🧪 Testing

```bash
# Run all tests
npm test

# Comprehensive testing with detailed output
npm run test:full

# System health check
npm run health
```

## 🔧 Troubleshooting

### Common Issues

**API Connection Errors:**
```bash
# Check API key configuration
echo $KUCOIN_API_KEY
echo $COINGECKO_API_KEY
```

**WebSocket Connection Issues:**
```bash
# Check server status
curl http://localhost:3456/api/health
```

**Indicator Calculation Errors:**
```bash
# Test indicators specifically
npm run test:full
```

### Performance Optimization

- Monitor memory usage: `ps aux | grep node`
- Check cache performance: `curl http://localhost:3456/api/health`
- Adjust refresh rates in `config.js`

## 📈 Usage Examples

### Manual Signal Testing
```bash
# Get current signal for ZBCNUSDT
curl "http://localhost:3456/api/signal?symbol=ZBCNUSDT"

# Get historical signals
curl "http://localhost:3456/api/signal-history?symbol=ZBCNUSDT&limit=10"
```

### Paper Trading
```bash
# Get portfolio summary
curl "http://localhost:3456/api/paper-trading/portfolio?symbol=ZBCNUSDT"

# Execute trade (paper mode)
curl -X POST http://localhost:3456/api/paper-trading/execute \
  -H "Content-Type: application/json" \
  -d '{"signal":"BUY","price":0.1234,"confidence":75}'
```

## 🔄 Maintenance

### Regular Tasks
- Update API keys every 3 months
- Monitor signal accuracy
- Review risk parameters
- Check for new indicator modules

### Updates
```bash
# Update dependencies
npm update

# Clean cache
rm -rf node_modules/.cache
```

## 📞 Support

- GitHub Issues: https://github.com/ilaykoslov/ZBCNUSDT/issues
- Documentation: See README.md and inline comments
- Troubleshooting: Check logs and test endpoints

## 🚨 Important Notes

- **This is a trading system - use with caution**
- Paper trading is recommended before live trading
- Never invest more than you can afford to lose
- Monitor market conditions and system performance
- Regular backup of signal history data

---

**Next Steps:** Configure API keys, start development server, and test the system functionality.