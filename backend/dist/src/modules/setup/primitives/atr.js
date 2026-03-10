"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.trueRange = trueRange;
exports.atrSeries = atrSeries;
function trueRange(bar, prev) {
    if (!prev)
        return bar.high - bar.low;
    return Math.max(bar.high - bar.low, Math.abs(bar.high - prev.close), Math.abs(bar.low - prev.close));
}
function atrSeries(bars, period = 14) {
    const tr = bars.map((b, i) => trueRange(b, i > 0 ? bars[i - 1] : undefined));
    const out = [];
    let sum = 0;
    for (let i = 0; i < tr.length; i++) {
        sum += tr[i];
        if (i >= period)
            sum -= tr[i - period];
        out.push(i >= period - 1 ? sum / period : NaN);
    }
    return out;
}
//# sourceMappingURL=atr.js.map