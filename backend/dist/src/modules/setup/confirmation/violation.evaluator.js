"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateViolation = evaluateViolation;
function evaluateViolation(bar, level, volumeState, avgRange) {
    if (volumeState !== 'EXPANSION')
        return null;
    const body = Math.abs(bar.close - bar.open);
    const isBearish = bar.close < bar.open;
    const isBullish = bar.close > bar.open;
    if (level.bias === 'BULLISH' &&
        isBearish &&
        bar.close < level.price &&
        body > avgRange * 0.8) {
        const pattern = level.type === 'VCP_PIVOT' ? 'PIVOT_BROKEN' : 'SUPPORT_BROKEN';
        return {
            pattern,
            bias: 'BEARISH',
            keyLevelType: level.type,
            keyLevelPrice: level.price,
        };
    }
    if (level.bias === 'BEARISH' && isBullish && bar.close > level.price) {
        return {
            pattern: 'RESISTANCE_RECLAIMED',
            bias: 'BULLISH',
            keyLevelType: level.type,
            keyLevelPrice: level.price,
        };
    }
    return null;
}
//# sourceMappingURL=violation.evaluator.js.map