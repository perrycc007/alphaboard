"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PullbackDetector = void 0;
const client_1 = require("@prisma/client");
const primitives_1 = require("../../primitives");
class PullbackDetector {
    type = client_1.SetupType.PULLBACK_BUY;
    detect(bars, _swingPoints, context) {
        if (!context.isStage2)
            return null;
        if (bars.length < 5)
            return null;
        if (!context.sma50)
            return null;
        const latestBar = bars[bars.length - 1];
        const sma50 = context.sma50;
        const abs = (0, primitives_1.averageBarSize)(bars);
        const distToMa = Math.abs(latestBar.close - sma50);
        if (distToMa > abs)
            return null;
        const recentVolumes = bars.slice(-3).map((b) => b.volume);
        const isVolumeDecline = recentVolumes[0] > recentVolumes[1] &&
            recentVolumes[1] > recentVolumes[2];
        if (!isVolumeDecline)
            return null;
        const stopPrice = Math.min(...bars.slice(-5).map((b) => b.low)) - abs;
        const riskPerShare = latestBar.close - stopPrice;
        return {
            type: client_1.SetupType.PULLBACK_BUY,
            direction: 'LONG',
            timeframe: 'DAILY',
            pivotPrice: latestBar.close,
            stopPrice,
            targetPrice: riskPerShare > 0 ? latestBar.close + riskPerShare * 5 : undefined,
            riskReward: 5,
            metadata: {
                maLevel: sma50,
                distanceToMa: Math.round(distToMa * 100) / 100,
            },
        };
    }
}
exports.PullbackDetector = PullbackDetector;
//# sourceMappingURL=pullback.detector.js.map