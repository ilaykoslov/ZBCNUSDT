from __future__ import annotations
from dataclasses import dataclass
from .indicators import IndicatorSnapshot

@dataclass
class Signal:
    direction: str
    duration_minutes: int
    entry: float
    target: float
    stop_loss: float
    strength: int
    total: int
    reasons: list[str]


def decide(s: IndicatorSnapshot, entry: float) -> Signal | None:
    votes: list[tuple[str, str]] = []
    if s.rsi is not None:
        votes.append(("YUKARI" if s.rsi < 30 else "AŞAĞI" if s.rsi > 70 else "NÖTR", f"RSI {s.rsi:.1f}"))
    if s.macd_histogram is not None:
        votes.append(("YUKARI" if s.macd_histogram > 0 else "AŞAĞI", f"MACD histogram {s.macd_histogram:+.5f}"))
    if s.bb_upper is not None and s.bb_lower is not None:
        votes.append(("AŞAĞI" if entry >= s.bb_upper else "YUKARI" if entry <= s.bb_lower else "NÖTR", "Bollinger"))
    if s.ema9 is not None and s.ema21 is not None:
        votes.append(("YUKARI" if s.ema9 > s.ema21 else "AŞAĞI", f"EMA 9/21 {s.ema9:.3f}/{s.ema21:.3f}"))
    if s.stochastic is not None:
        votes.append(("YUKARI" if s.stochastic < 20 else "AŞAĞI" if s.stochastic > 80 else "NÖTR", f"Stochastic {s.stochastic:.1f}"))
    total = len(votes)
    up = sum(v == "YUKARI" for v, _ in votes)
    down = sum(v == "AŞAĞI" for v, _ in votes)
    direction, strength = (("YUKARI", up) if up > down else ("AŞAĞI", down))
    if total == 0 or strength < 2 or strength / total < 0.60 or s.atr is None:
        return None
    duration = 5 if s.atr < entry * 0.0008 else 2 if s.atr < entry * 0.0018 else 1
    risk = s.atr * 1.25
    target = entry + risk * 2 if direction == "YUKARI" else entry - risk * 2
    stop = entry - risk if direction == "YUKARI" else entry + risk
    return Signal(direction, duration, entry, target, stop, strength, total, [why for v, why in votes if v == direction])
