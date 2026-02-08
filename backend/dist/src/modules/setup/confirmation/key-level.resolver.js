"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveKeyLevels = resolveKeyLevels;
function resolveKeyLevels(price, swingPoints, bases, indicators, tolerance) {
    const levels = [];
    for (const sp of swingPoints) {
        if (Math.abs(price - sp.price) <= tolerance) {
            levels.push({
                type: sp.type === 'HIGH' ? 'SWING_HIGH' : 'SWING_LOW',
                price: sp.price,
                bias: sp.type === 'HIGH' ? 'BEARISH' : 'BULLISH',
            });
        }
    }
    for (const base of bases) {
        if (Math.abs(price - base.baseLow) <= tolerance) {
            levels.push({ type: 'BASE_LOW', price: base.baseLow, bias: 'BULLISH' });
        }
        if (Math.abs(price - base.peakPrice) <= tolerance) {
            levels.push({
                type: 'BASE_HIGH',
                price: base.peakPrice,
                bias: 'BEARISH',
            });
        }
        if (base.pivotPrice && Math.abs(price - base.pivotPrice) <= tolerance) {
            levels.push({
                type: 'VCP_PIVOT',
                price: base.pivotPrice,
                bias: 'BULLISH',
            });
        }
    }
    if (indicators.sma20 && Math.abs(price - indicators.sma20) <= tolerance) {
        levels.push({
            type: 'MA_20',
            price: indicators.sma20,
            bias: price > indicators.sma20 ? 'BULLISH' : 'BEARISH',
        });
    }
    if (indicators.sma50 && Math.abs(price - indicators.sma50) <= tolerance) {
        levels.push({
            type: 'MA_50',
            price: indicators.sma50,
            bias: price > indicators.sma50 ? 'BULLISH' : 'BEARISH',
        });
    }
    if (indicators.sma200 && Math.abs(price - indicators.sma200) <= tolerance) {
        levels.push({
            type: 'MA_200',
            price: indicators.sma200,
            bias: price > indicators.sma200 ? 'BULLISH' : 'BEARISH',
        });
    }
    if (indicators.vwap && Math.abs(price - indicators.vwap) <= tolerance) {
        levels.push({
            type: 'VWAP',
            price: indicators.vwap,
            bias: price > indicators.vwap ? 'BULLISH' : 'BEARISH',
        });
    }
    return levels;
}
//# sourceMappingURL=key-level.resolver.js.map