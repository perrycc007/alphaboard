"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Ema20PullbackDetector = void 0;
const primitives_1 = require("../../primitives");
class Ema20PullbackDetector {
    type = 'EMA20_PULLBACK';
    detect(bars, _swingPoints, context) {
        if (bars.length < 10)
            return null;
        if (context.regime !== 'TREND')
            return null;
        const atr = context.atr14 ?? 0;
        if (atr <= 0)
            return null;
        const ema20 = context.ema20;
        const sma50 = context.sma50;
        if (ema20 == null || sma50 == null)
            return null;
        if (ema20 <= sma50)
            return null;
        const breakoutTypes = [
            'BREAKOUT_PIVOT',
            'VCP',
            'HIGH_TIGHT_FLAG',
        ];
        const hasActiveBreakout = context.activeSetups?.some((s) => breakoutTypes.includes(s.type) && s.state === 'TRIGGERED');
        const hasActiveBase = context.activeSetups?.some((s) => s.type === 'VCP' &&
            (s.state === 'BUILDING' || s.state === 'READY'));
        const ranges = bars.map((b) => b.high - b.low);
        const recentRanges = ranges.slice(-3);
        const priorRanges = ranges.slice(-8, -3);
        const avgRecentRange = recentRanges.length > 0
            ? recentRanges.reduce((acc, v) => acc + v, 0) / recentRanges.length
            : Infinity;
        const avgPriorRange = priorRanges.length > 0
            ? priorRanges.reduce((acc, v) => acc + v, 0) / priorRanges.length
            : Infinity;
        const hasContraction = Number.isFinite(avgRecentRange) &&
            Number.isFinite(avgPriorRange) &&
            avgRecentRange <= 0.8 * avgPriorRange;
        const hasBasePivotPullbackContext = Boolean(hasActiveBase && hasContraction);
        if (!hasActiveBreakout && !hasBasePivotPullbackContext)
            return null;
        const latestBar = bars[bars.length - 1];
        let maxClose = -Infinity;
        for (const b of bars) {
            if (b.close > maxClose)
                maxClose = b.close;
        }
        if (maxClose < ema20 + 2.0 * atr)
            return null;
        const touchedEma20 = latestBar.low <= ema20 && latestBar.high >= ema20;
        if (!touchedEma20)
            return null;
        const distFromEma20 = Math.abs(latestBar.close - ema20);
        if (distFromEma20 > 1 * atr)
            return null;
        const avgVol = context.avgVolume ?? 0;
        if (avgVol > 0) {
            const recentBars = bars.slice(-3);
            const hasExpansion = recentBars.some((b) => (0, primitives_1.classifyVolume)(b.volume, avgVol) === 'EXPANSION');
            if (hasExpansion)
                return null;
        }
        const stopPrice = ema20 - 1 * atr;
        const riskPerShare = latestBar.close - stopPrice;
        return {
            type: 'EMA20_PULLBACK',
            direction: 'LONG',
            timeframe: 'DAILY',
            pivotPrice: ema20,
            stopPrice,
            targetPrice: riskPerShare > 0 ? latestBar.close + riskPerShare * 3 : undefined,
            riskReward: 3,
            evidence: [
                'regime_trend',
                hasActiveBreakout ? 'active_breakout' : 'base_pivot_contraction',
                'ema20_pullback_touch',
                'meaningful_departure',
            ],
            metadata: {
                context: hasActiveBreakout ? 'POST_BREAKOUT' : 'BASE_PIVOT_CONTRACTION',
                setupClass: 'TREND_FOLLOWING_20EMA_PULLBACK',
                regime: 'TREND',
                ema20,
                sma50,
                touchedEma20,
                hasContraction,
                avgRecentRange: Number.isFinite(avgRecentRange)
                    ? Math.round(avgRecentRange * 100) / 100
                    : undefined,
                avgPriorRange: Number.isFinite(avgPriorRange)
                    ? Math.round(avgPriorRange * 100) / 100
                    : undefined,
                departureClose: maxClose,
                departureAtr: Math.round(((maxClose - ema20) / atr) * 100) / 100,
                distFromEma20Atr: Math.round((distFromEma20 / atr) * 100) / 100,
                atrUsed: atr,
            },
        };
    }
}
exports.Ema20PullbackDetector = Ema20PullbackDetector;
//# sourceMappingURL=ema20-pullback.detector.js.map