"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emaGapSeries = emaGapSeries;
exports.isConverging = isConverging;
function computeEma(prices, period) {
    const k = 2 / (period + 1);
    const ema = [prices[0]];
    for (let i = 1; i < prices.length; i++) {
        ema.push(prices[i] * k + ema[i - 1] * (1 - k));
    }
    return ema;
}
function emaGapSeries(bars, fast, slow) {
    if (bars.length < slow)
        return [];
    const closes = bars.map((b) => b.close);
    const emaFast = computeEma(closes, fast);
    const emaSlow = computeEma(closes, slow);
    return emaFast.map((f, i) => Math.abs(f - emaSlow[i]));
}
function isConverging(series, lookback) {
    if (series.length < lookback)
        return false;
    const tail = series.slice(-lookback);
    let decreasingCount = 0;
    for (let i = 1; i < tail.length; i++) {
        if (tail[i] < tail[i - 1])
            decreasingCount++;
    }
    return decreasingCount >= (tail.length - 1) * 0.6;
}
//# sourceMappingURL=ema-gap.js.map