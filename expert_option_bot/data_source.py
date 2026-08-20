from __future__ import annotations
import csv, random
from datetime import datetime, timedelta, timezone


def load_csv(path: str) -> list[dict]:
    with open(path, newline="", encoding="utf-8") as f:
        return [{k: (v if k == "timestamp" else float(v)) for k, v in row.items()} for row in csv.DictReader(f)]


def demo_candles(count: int = 160, start: float = 147.8) -> list[dict]:
    random.seed(7)
    now = datetime.now(timezone.utc) - timedelta(minutes=count)
    price = start
    rows = []
    for i in range(count):
        drift = 0.003 * (1 if i % 23 < 13 else -1)
        close = price + drift + random.uniform(-0.025, 0.025)
        high, low = max(price, close) + random.uniform(0.001, 0.018), min(price, close) - random.uniform(0.001, 0.018)
        rows.append({"timestamp": (now + timedelta(minutes=i)).isoformat(), "open": price, "high": high, "low": low, "close": close, "volume": 1.0})
        price = close
    return rows
