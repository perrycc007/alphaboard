"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FailBreakoutDetector = void 0;
const client_1 = require("@prisma/client");
const primitives_1 = require("../../primitives");
class FailBreakoutDetector {
    type = client_1.SetupType.FAIL_BREAKOUT;
    detect(bars, _swingPoints, context) {
        if (bars.length < 3)
            return null;
        const triggeredBreakout = context.activeSetups?.find((s) => (s.type === client_1.SetupType.BREAKOUT_PIVOT ||
            s.type === client_1.SetupType.BREAKOUT_VCB) &&
            s.state === 'TRIGGERED' &&
            s.pivotPrice != null);
        if (!triggeredBreakout || triggeredBreakout.pivotPrice == null)
            return null;
        const pivot = Number(triggeredBreakout.pivotPrice);
        const abs = (0, primitives_1.averageBarSize)(bars);
        const latestBar = bars[bars.length - 1];
        const prevBar = bars[bars.length - 2];
        const avgVol = context.avgVolume ?? 0;
        if (latestBar.close >= pivot)
            return null;
        const dropFromPivot = pivot - latestBar.close;
        const threshold = Math.max(abs, pivot * 0.005);
        if (dropFromPivot < threshold)
            return null;
        const twoConsecutive = prevBar.close < pivot && latestBar.close < pivot;
        const volumeExpansion = avgVol > 0 && latestBar.volume > avgVol * 1.5;
        if (!twoConsecutive && !volumeExpansion)
            return null;
        const stopPrice = pivot + abs;
        const riskPerShare = stopPrice - latestBar.close;
        return {
            type: client_1.SetupType.FAIL_BREAKOUT,
            direction: 'SHORT',
            timeframe: 'DAILY',
            pivotPrice: pivot,
            stopPrice,
            targetPrice: riskPerShare > 0 ? latestBar.close - riskPerShare * 5 : undefined,
            riskReward: 5,
            evidence: [
                twoConsecutive ? 'two_consecutive_below' : 'single_close_volume',
            ],
            metadata: {
                pivot,
                failureClose: latestBar.close,
                dropFromPivot: Math.round(dropFromPivot * 100) / 100,
                failureStrength: dropFromPivot / abs,
            },
        };
    }
}
exports.FailBreakoutDetector = FailBreakoutDetector;
//# sourceMappingURL=fail-breakout.detector.js.map