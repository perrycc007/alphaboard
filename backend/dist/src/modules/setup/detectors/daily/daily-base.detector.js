"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DailyBaseDetector = void 0;
const client_1 = require("@prisma/client");
const primitives_1 = require("../../primitives");
class DailyBaseDetector {
    type = client_1.SetupType.BREAKOUT_PIVOT;
    detect(bars, swingPoints, context) {
        if (!context.isStage2)
            return null;
        if (bars.length < 20)
            return null;
        const swingHighs = swingPoints.filter((p) => p.type === 'HIGH');
        if (swingHighs.length === 0)
            return null;
        const lastSwingHigh = swingHighs[swingHighs.length - 1];
        const peakPrice = lastSwingHigh.price;
        const peakIndex = lastSwingHigh.index;
        const barsAfterPeak = bars.slice(peakIndex);
        if (barsAfterPeak.length < 20)
            return null;
        let baseLow = Infinity;
        let hasNewHigh = false;
        const abs = (0, primitives_1.averageBarSize)(bars);
        for (const bar of barsAfterPeak) {
            if (bar.low < baseLow)
                baseLow = bar.low;
            if (bar.high > peakPrice + abs) {
                hasNewHigh = true;
                break;
            }
        }
        if (hasNewHigh)
            return null;
        if (baseLow === Infinity)
            return null;
        const retracePct = (peakPrice - baseLow) / peakPrice;
        if (retracePct > 0.5)
            return null;
        const durationDays = barsAfterPeak.length;
        const baseSwingHighs = swingPoints.filter((p) => p.type === 'HIGH' && p.index > peakIndex);
        const pivotPrice = baseSwingHighs.length > 0
            ? baseSwingHighs[baseSwingHighs.length - 1].price
            : peakPrice;
        const stopPrice = baseLow - abs;
        const riskPerShare = pivotPrice - stopPrice;
        const targetPrice = pivotPrice + riskPerShare * 5;
        return {
            type: client_1.SetupType.BREAKOUT_PIVOT,
            direction: 'LONG',
            timeframe: 'DAILY',
            pivotPrice,
            stopPrice,
            targetPrice,
            riskReward: riskPerShare > 0 ? (targetPrice - pivotPrice) / riskPerShare : undefined,
            metadata: {
                peakPrice,
                baseLow,
                retracePct: Math.round(retracePct * 10000) / 10000,
                durationDays,
            },
        };
    }
}
exports.DailyBaseDetector = DailyBaseDetector;
//# sourceMappingURL=daily-base.detector.js.map