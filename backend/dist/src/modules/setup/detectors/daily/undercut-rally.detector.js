"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UndercutRallyDetector = void 0;
const client_1 = require("@prisma/client");
const primitives_1 = require("../../primitives");
class UndercutRallyDetector {
    type = client_1.SetupType.UNDERCUT_RALLY;
    detect(bars, swingPoints, _context) {
        if (bars.length < 5)
            return null;
        const swingLows = swingPoints.filter((p) => p.type === 'LOW');
        if (swingLows.length === 0)
            return null;
        const abs = (0, primitives_1.averageBarSize)(bars);
        const latestBar = bars[bars.length - 1];
        const prevBar = bars[bars.length - 2];
        const recentSwingLow = swingLows[swingLows.length - 1];
        const swingLowPrice = recentSwingLow.price;
        if (prevBar.low >= swingLowPrice)
            return null;
        if (latestBar.close <= swingLowPrice)
            return null;
        const stopPrice = prevBar.low - abs;
        const riskPerShare = latestBar.close - stopPrice;
        return {
            type: client_1.SetupType.UNDERCUT_RALLY,
            direction: 'LONG',
            timeframe: 'DAILY',
            pivotPrice: swingLowPrice,
            stopPrice,
            targetPrice: riskPerShare > 0 ? latestBar.close + riskPerShare * 5 : undefined,
            riskReward: 5,
            evidence: ['undercut_reclaim'],
            metadata: {
                swingLowPrice,
                undercutLow: prevBar.low,
                reclaimClose: latestBar.close,
            },
        };
    }
}
exports.UndercutRallyDetector = UndercutRallyDetector;
//# sourceMappingURL=undercut-rally.detector.js.map