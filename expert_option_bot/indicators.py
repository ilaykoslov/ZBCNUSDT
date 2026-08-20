from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional
import math


@dataclass
class IndicatorSnapshot:
    rsi: Optional[float]
    macd: Optional[float]
    macd_signal: Optional[float]
    macd_histogram: Optional[float]
    bb_upper: Optional[float]
    bb_middle: Optional[float]
    bb_lower: Optional[float]
    ema9: Optional[float]
    ema21: Optional[float]
    stochastic: Optional[float]
    atr: Optional[float]


def sma(values: List[float], period: int) -> Optional[float]:
    return sum(values[-period:]) / period if len(values) >= period else None


def ema(values: List[float], period: int) -> Optional[float]:
    if len(values) < period:
        return None
    result = sum(values[:period]) / period
    alpha = 2 / (period + 1)
    for value in values[period:]:
        result = alpha * value + (1 - alpha) * result
    return result


def rsi(values: List[float], period: int = 14) -> Optional[float]:
    if len(values) <= period:
        return None
    gains, losses = [], []
    for old, new in zip(values[-period - 1:-1], values[-period:]):
        change = new - old
        gains.append(max(change, 0))
        losses.append(max(-change, 0))
    avg_gain, avg_loss = sum(gains) / period, sum(losses) / period
    if avg_loss == 0:
        return 100.0
    return 100 - (100 / (1 + avg_gain / avg_loss))


def atr(highs: List[float], lows: List[float], closes: List[float], period: int = 14) -> Optional[float]:
    if len(closes) <= period:
        return None
    trs = [max(h - l, abs(h - prev), abs(l - prev)) for h, l, prev in zip(highs[1:], lows[1:], closes[:-1])]
    return sum(trs[-period:]) / period


def snapshot(candles: list[dict]) -> IndicatorSnapshot:
    closes = [float(c["close"]) for c in candles]
    highs = [float(c["high"]) for c in candles]
    lows = [float(c["low"]) for c in candles]
    fast, slow = ema(closes, 12), ema(closes, 26)
    macd_values = []
    for i in range(26, len(closes) + 1):
        part = closes[:i]
        e12, e26 = ema(part, 12), ema(part, 26)
        if e12 is not None and e26 is not None:
            macd_values.append(e12 - e26)
    macd_value = (fast - slow) if fast is not None and slow is not None else None
    signal_value = ema(macd_values, 9) if macd_values else None
    middle = sma(closes, 20)
    deviation = (math.sqrt(sum((x - middle) ** 2 for x in closes[-20:]) / 20) if middle is not None else None)
    return IndicatorSnapshot(
        rsi= rsi(closes), macd=macd_value, macd_signal=signal_value,
        macd_histogram=(macd_value - signal_value if macd_value is not None and signal_value is not None else None),
        bb_upper=(middle + 2 * deviation if middle is not None and deviation is not None else None),
        bb_middle=middle, bb_lower=(middle - 2 * deviation if middle is not None and deviation is not None else None),
        ema9=ema(closes, 9), ema21=ema(closes, 21),
        stochastic=(100 * (closes[-1] - min(lows[-14:])) / (max(highs[-14:]) - min(lows[-14:])) if len(closes) >= 14 and max(highs[-14:]) != min(lows[-14:]) else None),
        atr=atr(highs, lows, closes),
    )
