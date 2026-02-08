"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isDryUp = isDryUp;
exports.isWickAbsorption = isWickAbsorption;
exports.isEngulfing = isEngulfing;
function isDryUp(bar, avgRange, avgVolume) {
    const range = bar.high - bar.low;
    return range < 0.6 * avgRange && bar.volume < 0.6 * avgVolume;
}
function isWickAbsorption(bar, bias) {
    const body = Math.abs(bar.close - bar.open);
    if (body === 0)
        return false;
    const upperWick = bar.high - Math.max(bar.open, bar.close);
    const lowerWick = Math.min(bar.open, bar.close) - bar.low;
    if (bias === 'BULLISH') {
        return lowerWick > 2 * body && upperWick < body;
    }
    return upperWick > 2 * body && lowerWick < body;
}
function isEngulfing(current, previous) {
    const currOpen = current.open;
    const currClose = current.close;
    const prevOpen = previous.open;
    const prevClose = previous.close;
    const currBodyHigh = Math.max(currOpen, currClose);
    const currBodyLow = Math.min(currOpen, currClose);
    const prevBodyHigh = Math.max(prevOpen, prevClose);
    const prevBodyLow = Math.min(prevOpen, prevClose);
    if (currBodyHigh > prevBodyHigh && currBodyLow < prevBodyLow) {
        return currClose > currOpen ? 'BULLISH' : 'BEARISH';
    }
    return null;
}
//# sourceMappingURL=candlestick-patterns.js.map