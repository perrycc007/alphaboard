"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.macdHistogram = macdHistogram;
exports.isHistogramContracting = isHistogramContracting;
function computeEma(prices, period) {
    const k = 2 / (period + 1);
    const ema = [prices[0]];
    for (let i = 1; i < prices.length; i++) {
        ema.push(prices[i] * k + ema[i - 1] * (1 - k));
    }
    return ema;
}
function macdHistogram(bars, fast = 6, slow = 20, signal = 9) {
    if (bars.length < slow + signal)
        return [];
    const closes = bars.map((b) => b.close);
    const emaFast = computeEma(closes, fast);
    const emaSlow = computeEma(closes, slow);
    const macdLine = emaFast.map((f, i) => f - emaSlow[i]);
    const signalLine = computeEma(macdLine, signal);
    return macdLine.map((m, i) => m - signalLine[i]);
}
function isHistogramContracting(histogram, lookback) {
    if (histogram.length < lookback)
        return false;
    const tail = histogram.slice(-lookback);
    let contractingCount = 0;
    for (let i = 1; i < tail.length; i++) {
        if (Math.abs(tail[i]) < Math.abs(tail[i - 1]))
            contractingCount++;
    }
    return contractingCount >= (tail.length - 1) * 0.6;
}
//# sourceMappingURL=macd-histogram.js.map