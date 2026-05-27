# ZBCNUSDT - İndikatör Dokümantasyonu

## 📊 Mevcut İndikatörler

### 1. SMA (Simple Moving Average)
**Formül:** `SMA = Σ(close) / period`

| Periyot | Açıklama |
|---------|----------|
| 7 | Kısa vadeli trend |
| 25 | Orta vadeli trend |
| 99 | Uzun vadeli trend |

**Kullanım:**
- Fiyat > SMA → Trend yukarı (AL)
- Fiyat < SMA → Trend aşağı (SAT)
- SMA düzeni (7>25>99) → Güçlü trend

### 2. EMA (Exponential Moving Average)
**Formül:** `EMA = (price * multiplier) + (EMA_prev * (1 - multiplier))`

| Periyot | Açıklama |
|---------|----------|
| 12 | Hızlı EMA |
| 26 | Yavaş EMA |
| 9 | MACD sinyal |

**Kullanım:**
- MACD hesaplaması için temel

### 3. RSI (Relative Strength Index)
**Formül:** `RSI = 100 - (100 / (1 + RS))`

**Periyot:** 14

**Seviyeler:**
- > 70: Aşırı alım (SAT)
- < 30: Aşırı satım (AL)
- 40-60: Nötr

### 4. MACD (Moving Average Convergence Divergence)
**Formül:**
- MACD Line: EMA(12) - EMA(26)
- Signal Line: EMA(MACD, 9)
- Histogram: MACD - Signal

**Kullanım:**
- MACD > Signal → AL
- MACD < Signal → SAT
- Histogram artıyor → Momentum güçlü

### 5. Bollinger Bands
**Formül:**
- Upper Band: SMA(20) + 2 * σ
- Middle Band: SMA(20)
- Lower Band: SMA(20) - 2 * σ

**Kullanım:**
- Price > Upper → Aşırı alım
- Price < Lower → Aşırı satım
- Bandwidth < 0.03 → Squeeze (patlama beklenir)

### 6. ATR (Average True Range)
**Formül:** `ATR = SMA(True Range, period)`

**True Range:** `max(high-low, |high-prev_close|, |low-prev_close|)`

**Periyot:** 14

**Kullanım:**
- Volatilite ölçümü
- Stop-loss belirleme

### 7. Stochastic RSI
**Formül:** `StochRSI = (RSI - min(RSI)) / (max(RSI) - min(RSI)) * 100`

**Periyot:** 14

**Kullanım:**
- K > 80 → Aşırı alım
- K < 20 → Aşırı satım
- K > D → Bullish

### 8. OBV (On-Balance Volume)
**Formül:**
- close > prev_close → OBV += volume
- close < prev_close → OBV -= volume

**Kullanım:**
- OBV ↑ → Hacim artıyor (trend teyidi)
- OBV ↓ → Hacim azalıyor

### 9. ADX (Average Directional Index)
**Formül:** `ADX = SMA(DX, period)`

**Periyot:** 14

**Seviyeler:**
- > 25: Güçlü trend
- < 20: Zayıf trend

**+DI / -DI:**
- +DI > -DI → Yükseliş
- -DI > +DI → Düşüş

### 10. Divergence Detection
**Yöntem:** Price ve RSI tepe/dip karşılaştırması

**Türler:**
- Bullish Divergence: Price ↓, RSI ↑
- Bearish Divergence: Price ↑, RSI ↓

### 11. Support/Resistance
**Yöntem:** Swing high/low tespiti

**Kullanım:**
- Near Support → AL
- Near Resistance → SAT

### 12. Pivot Levels
**Formül:**
- PP = (High + Low + Close) / 3
- R1 = 2*PP - Low
- S1 = 2*PP - High

## 🆕 Yeni İndikatörler (v2.2.0)

### 13. Ichimoku Cloud
**Formül:**
- Tenkan: (HH9 + LL9) / 2
- Kijun: (HH26 + LL26) / 2
- Senkou A: (Tenkan + Kijun) / 2
- Senkou B: (HH52 + LL52) / 2
- Chikou: Close (26 periyot geri)

**Kullanım:**
- Price > Cloud → Trend-up
- Price < Cloud → Trend-down
- Tenkan > Kijun → AL

### 14. Williams %R
**Formül:** `%R = (HH - Close) / (HH - LL) * -100`

**Periyot:** 14

**Seviyeler:**
- < -80 → Aşırı satım (AL)
- > -20 → Aşırı alım (SAT)

### 15. CCI (Commodity Channel Index)
**Formül:** `CCI = (TP - SMA) / (0.015 * MD)`

**Periyot:** 20

**Seviyeler:**
- > 100 → Aşırı alım
- < -100 → Aşırı satım

### 16. VWAP (Volume Weighted Average Price)
**Formül:** `VWAP = Σ(Price * Volume) / Σ(Volume)`

**Kullanım:**
- Price > VWAP → AL
- Price < VWAP → SAT

### 17. Volume Profile
**Yöntem:** Hacim bazlı fiyat seviyeleri

**Çıktılar:**
- PVP: Point of Control (en yüksek hacim)
- Value Area: Toplam hacmin %70'i

## 📈 Sinyal Skorlama

### Kategori Ağırlıkları

| Kategori | Varsayılan | Trend-Up | Range/Chop |
|----------|------------|----------|------------|
| Trend | 30% | 40% | 20% |
| Momentum | 25% | 30% | 20% |
| Volatility | 15% | 10% | 25% |
| Volume | 15% | 15% | 15% |
| Structure | 15% | 12% | 20% |

### Skor Aralığı
- **-100 to +100** arası skor
- **BUY:** score >= 12
- **SELL:** score <= -12
- **NEUTRAL:** arada

### Güven Skoru
```
BUY: 55 + (score * 0.5), max 95%
SELL: 55 + (score * 0.5), max 95%
NEUTRAL: 45 - (score * 0.5), min 25%
```

## 🎯 Trade Grade

| Grade | Score | Confidence | Regime | Açıklama |
|-------|-------|------------|--------|----------|
| S | >= 25 | >= 85% | Trend | SÜPER |
| A | >= 18 | >= 70% | - | Güçlü |
| B | >= 12 | >= 55% | - | Orta |
| C | >= 6 | >= 40% | - | Zayıf |
| NT | < 6 | < 40% | - | İşlem Yok |

## 📊 Multi-Timeframe Confluence

| Timeframe | Weight | Açıklama |
|-----------|--------|----------|
| 1h | 50% | Ana trend |
| 15m | 20% | Kısa vadeli |
| 4h | 30% | Orta vadeli |

**Uyum Seviyeleri:**
- **Tam Uyum:** Tüm TF aynı sinyal
- **Kısmi Uyum:** Çoğunluk aynı sinyal
- **Karışık:** Farklı sinyaller