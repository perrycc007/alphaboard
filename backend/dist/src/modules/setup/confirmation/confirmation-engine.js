"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateBar = evaluateBar;
const key_level_resolver_1 = require("./key-level.resolver");
const violation_evaluator_1 = require("./violation.evaluator");
const primitives_1 = require("../primitives");
function evaluateBar(bar, prevBar, context) {
    const tolerance = context.avgRange || (0, primitives_1.averageBarSize)([bar, prevBar]);
    const keyLevels = (0, key_level_resolver_1.resolveKeyLevels)(bar.close, context.swingPoints, context.bases, context.indicators, tolerance);
    if (keyLevels.length === 0)
        return [];
    const volumeState = (0, primitives_1.classifyVolume)(bar.volume, context.avgVolume);
    if (volumeState === 'NORMAL')
        return [];
    const evidence = [];
    for (const level of keyLevels) {
        const violation = (0, violation_evaluator_1.evaluateViolation)(bar, level, volumeState, context.avgRange);
        if (violation) {
            evidence.push({
                ...violation,
                isViolation: true,
                volumeState,
            });
            continue;
        }
        if ((0, primitives_1.isDryUp)(bar, context.avgRange, context.avgVolume)) {
            if (volumeState === 'CONTRACTION') {
                evidence.push({
                    pattern: level.bias === 'BULLISH' ? 'DRY_UP' : 'RESISTANCE_DRY_UP',
                    bias: level.bias,
                    isViolation: false,
                    keyLevelType: level.type,
                    keyLevelPrice: level.price,
                    volumeState,
                });
            }
        }
        if (volumeState === 'EXPANSION') {
            if ((0, primitives_1.isWickAbsorption)(bar, level.bias)) {
                evidence.push({
                    pattern: level.bias === 'BULLISH'
                        ? 'LOWER_WICK_ABSORPTION'
                        : 'UPPER_WICK_REJECTION',
                    bias: level.bias,
                    isViolation: false,
                    keyLevelType: level.type,
                    keyLevelPrice: level.price,
                    volumeState,
                });
            }
        }
        if (volumeState === 'EXPANSION') {
            const engulfType = (0, primitives_1.isEngulfing)(bar, prevBar);
            if (engulfType) {
                evidence.push({
                    pattern: engulfType === 'BULLISH'
                        ? 'BULLISH_ENGULFING'
                        : 'BEARISH_ENGULFING',
                    bias: engulfType,
                    isViolation: false,
                    keyLevelType: level.type,
                    keyLevelPrice: level.price,
                    volumeState,
                });
            }
        }
    }
    return evidence;
}
//# sourceMappingURL=confirmation-engine.js.map