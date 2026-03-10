"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MaRallyFailureDetector = void 0;
const primitives_1 = require("../../primitives");
class MaRallyFailureDetector {
    type = 'MA_RALLY_FAILURE';
    detect(bars, _swingPoints, context) {
        if (bars.length < 15)
            return null;
        if (context.regime !== 'FAILURE')
            return null;
        const hasExistingFailureRally = context.activeSetups?.some((s) => s.type === 'MA_RALLY_FAILURE' &&
            (s.state === 'TRIGGERED' ||
                s.state === 'ACTIVE' ||
                s.state === 'READY' ||
                s.state === 'BUILDING'));
        if (hasExistingFailureRally)
            return null;
        const atr = context.atr14 ?? 0;
        if (atr <= 0)
            return null;
        const ema20 = context.ema20;
        const sma50 = context.sma50;
        if (ema20 == null || sma50 == null)
            return null;
        const latestBar = bars[bars.length - 1];
        let weakSignals = 0;
        const eff10 = (0, primitives_1.priceEfficiency)(bars.slice(-10));
        if (eff10 < 0.35)
            weakSignals++;
        const gap = (0, primitives_1.emaGapSeries)(bars, 20, 50);
        if (gap.length >= 10 && !(0, primitives_1.isConverging)(gap, 10)) {
            weakSignals++;
        }
        const avgVol = context.avgVolume ?? 0;
        if (avgVol > 0) {
            const recentBars = bars.slice(-5);
            const noExpansion = recentBars.every((b) => (0, primitives_1.classifyVolume)(b.volume, avgVol) !== 'EXPANSION');
            if (noExpansion)
                weakSignals++;
        }
        if (weakSignals === 0)
            return null;
        if (ema20 < sma50) {
            const distToSma50 = Math.abs(latestBar.high - sma50);
            if (distToSma50 <= 1 * atr && latestBar.close < sma50) {
                const stopPrice = sma50 + 0.5 * atr;
                const riskPerShare = stopPrice - latestBar.close;
                return {
                    type: 'MA_RALLY_FAILURE',
                    direction: 'SHORT',
                    timeframe: 'DAILY',
                    pivotPrice: sma50,
                    stopPrice,
                    targetPrice: riskPerShare > 0
                        ? latestBar.close - riskPerShare * 3
                        : undefined,
                    riskReward: 3,
                    evidence: [
                        'regime_failure',
                        'first_rally_back',
                        'weak_rally',
                        'sma50_resistance',
                    ],
                    metadata: {
                        context: 'BASE_FAILURE',
                        ma: 'SMA50',
                        sma50,
                        ema20,
                        priceEfficiency10: Math.round(eff10 * 100) / 100,
                        distToMaAtr: Math.round((distToSma50 / atr) * 100) / 100,
                        atrUsed: atr,
                    },
                };
            }
        }
        const ema20SlopeNegative = bars.length >= 10 && ema20 < bars[bars.length - 10].close;
        if (ema20SlopeNegative) {
            const distToEma20 = Math.abs(latestBar.high - ema20);
            if (distToEma20 <= 1 * atr && latestBar.close < ema20) {
                const stopPrice = ema20 + 0.5 * atr;
                const riskPerShare = stopPrice - latestBar.close;
                return {
                    type: 'MA_RALLY_FAILURE',
                    direction: 'SHORT',
                    timeframe: 'DAILY',
                    pivotPrice: ema20,
                    stopPrice,
                    targetPrice: riskPerShare > 0
                        ? latestBar.close - riskPerShare * 3
                        : undefined,
                    riskReward: 3,
                    evidence: [
                        'regime_failure',
                        'first_rally_back',
                        'weak_rally',
                        'ema20_resistance',
                        'ema20_slope_negative',
                    ],
                    metadata: {
                        context: 'BASE_FAILURE',
                        ma: 'EMA20',
                        ema20,
                        sma50,
                        priceEfficiency10: Math.round(eff10 * 100) / 100,
                        distToMaAtr: Math.round((distToEma20 / atr) * 100) / 100,
                        atrUsed: atr,
                    },
                };
            }
        }
        return null;
    }
}
exports.MaRallyFailureDetector = MaRallyFailureDetector;
//# sourceMappingURL=ma-rally-failure.detector.js.map