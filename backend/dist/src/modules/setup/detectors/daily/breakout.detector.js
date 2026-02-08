"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BreakoutDetector = void 0;
const client_1 = require("@prisma/client");
const primitives_1 = require("../../primitives");
class BreakoutDetector {
    type = client_1.SetupType.BREAKOUT_PIVOT;
    detect(bars, _swingPoints, context) {
        if (bars.length < 2)
            return null;
        const latestBar = bars[bars.length - 1];
        const avgVol = context.avgVolume ?? 0;
        const abs = (0, primitives_1.averageBarSize)(bars);
        const readyVcp = context.activeSetups?.find((s) => (s.type === client_1.SetupType.VCP || s.type === client_1.SetupType.BREAKOUT_PIVOT) &&
            s.state === 'READY' &&
            s.pivotPrice != null);
        if (!readyVcp || readyVcp.pivotPrice == null)
            return null;
        const pivot = Number(readyVcp.pivotPrice);
        if (latestBar.close <= pivot)
            return null;
        if (avgVol > 0 && latestBar.volume < avgVol * 1.5)
            return null;
        const stopPrice = latestBar.low - abs;
        const riskPerShare = latestBar.close - stopPrice;
        return {
            type: client_1.SetupType.BREAKOUT_PIVOT,
            direction: 'LONG',
            timeframe: 'DAILY',
            pivotPrice: pivot,
            stopPrice,
            targetPrice: riskPerShare > 0 ? latestBar.close + riskPerShare * 5 : undefined,
            riskReward: 5,
            evidence: ['volume_expansion', 'close_above_pivot'],
            metadata: {
                breakoutClose: latestBar.close,
                volumeRatio: avgVol > 0 ? latestBar.volume / avgVol : null,
            },
        };
    }
}
exports.BreakoutDetector = BreakoutDetector;
//# sourceMappingURL=breakout.detector.js.map