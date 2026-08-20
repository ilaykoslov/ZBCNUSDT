from __future__ import annotations
import argparse
from datetime import datetime
from .data_source import demo_candles, load_csv
from .indicators import snapshot
from .strategy import decide


def render(candles: list[dict]) -> str:
    latest = candles[-1]
    price = float(latest["close"])
    ind = snapshot(candles)
    signal = decide(ind, price)
    lines = ["=" * 80, "  EXPERT OPTION USDJPY — SİNYAL İZLEYİCİ (PAPER)", "=" * 80,
             f"  Son Güncelleme: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", f"  USDJPY Anlık Fiyat: {price:.3f}",
             f"  Volatilite (ATR): {ind.atr:.5f}" if ind.atr is not None else "  Volatilite (ATR): hesaplanamadı", "", "  GÖSTERGE ANALİZİ", "-" * 80,
             f"  RSI (14)        : {ind.rsi:.1f}" if ind.rsi is not None else "  RSI (14)        : N/A",
             f"  MACD histogram  : {ind.macd_histogram:+.5f}" if ind.macd_histogram is not None else "  MACD histogram  : N/A",
             f"  Bollinger       : {ind.bb_lower:.3f} / {ind.bb_middle:.3f} / {ind.bb_upper:.3f}" if ind.bb_middle is not None else "  Bollinger       : N/A",
             f"  EMA 9/21        : {ind.ema9:.3f} / {ind.ema21:.3f}" if ind.ema9 is not None and ind.ema21 is not None else "  EMA 9/21        : N/A",
             f"  Stochastic      : {ind.stochastic:.1f}" if ind.stochastic is not None else "  Stochastic      : N/A", "", "  SİNYAL KARARI", "-" * 80]
    if signal:
        lines += ["  İŞLEM SİNYALİ (EĞİTİM/PAPER)", f"  YÖN          : {signal.direction}", f"  VADE         : {signal.duration_minutes} dakika",
                  f"  GİRİŞ FİYATI : {signal.entry:.3f}", f"  HEDEF        : {signal.target:.3f}", f"  STOP-LOSS    : {signal.stop_loss:.3f}",
                  f"  SİNYAL GÜCÜ  : %{signal.strength / signal.total * 100:.0f} ({signal.strength}/{signal.total})",
                  f"  GEREKÇE      : {' + '.join(signal.reasons)}", "  Gerçek emir gönderilmez; bu çıktı paper-only'dir."]
    else:
        lines += ["  SİNYAL YOK — eşik sağlanmadı.", "  Gerçek emir gönderilmez; bu çıktı paper-only'dir."]
    lines.append("=" * 80)
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description="USDJPY paper-only sinyal izleyici")
    parser.add_argument("--csv", help="OHLCV CSV dosyası")
    parser.add_argument("--demo", action="store_true", help="yerel demo verisi kullan")
    parser.add_argument("--once", action="store_true", help="tek analiz yap")
    args = parser.parse_args()
    candles = load_csv(args.csv) if args.csv else demo_candles()
    if len(candles) < 40:
        raise SystemExit("En az 40 mum gereklidir.")
    print(render(candles))

if __name__ == "__main__":
    main()
