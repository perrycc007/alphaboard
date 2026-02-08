"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MomentumContinuationDetector = void 0;
const client_1 = require("@prisma/client");
const primitives_1 = require("../../primitives");
class MomentumContinuationDetector {
    type = client_1.SetupType.MOMENTUM_CONTINUATION;
    detect(bars, _swingPoints, context) {
        if (!context.isStage2)
            return null;
        if (bars.length < 42)
            return null;
        const recent = bars.slice(-42);
        const startPrice = recent[0].close;
        const peak = Math.max(...recent.map((b) => b.high));
        if (peak < startPrice * 2)
            return null;
        const latestBar = bars[bars.length - 1];
        const retrace = (peak - latestBar.close) / peak;
        if (retrace > 0.2)
            return null;
        const abs = (0, primitives_1.averageBarSize)(bars);
        const stopPrice = latestBar.low - abs;
        const riskPerShare = latestBar.close - stopPrice;
        return {
            type: client_1.SetupType.MOMENTUM_CONTINUATION,
            direction: 'LONG',
            timeframe: 'DAILY',
            pivotPrice: peak,
            stopPrice,
            targetPrice: riskPerShare > 0 ? latestBar.close + riskPerShare * 5 : undefined,
            riskReward: 5,
            metadata: {
                risePercent: Math.round(((peak - startPrice) / startPrice) * 100),
                retracePct: Math.round(retrace * 100),
            },
        };
    }
}
exports.MomentumContinuationDetector = MomentumContinuationDetector;
//# sourceMappingURL=momentum.detector.js.map