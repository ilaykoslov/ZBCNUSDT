const symbols = ['ZBCNUSDT', 'PROSUSDT', 'WLFIUSDT', 'SOLUSDT'];

(async () => {
  for (const symbol of symbols) {
    const response = await fetch(`http://127.0.0.1:3456/api/all?symbol=${symbol}`);
    const payload = await response.json();
    const ticker = payload.ticker?.data || {};
    const signal = payload.signal || payload.signalData || {};
    console.log(JSON.stringify({
      symbol,
      status: response.status,
      tickerSymbol: ticker.symbol,
      last: ticker.last,
      changeRate: ticker.changeRate,
      signal: signal.signal,
      signalSymbol: signal.symbol,
      cached: payload._cached,
      validation: payload._validation
    }));
  }
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
