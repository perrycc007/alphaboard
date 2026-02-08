"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DoubleTopDetector = void 0;
const client_1 = require("@prisma/client");
const primitives_1 = require("../../primitives");
class DoubleTopDetector {
    type = client_1.SetupType.DOUBLE_TOP;
    detect(bars, swingPoints, _context) {
        if (bars.length < 5)
            return null;
        const swingHighs = swingPoints.filter((p) => p.type === 'HIGH');
        if (swingHighs.length < 2)
            return null;
        const abs = (0, primitives_1.averageBarSize)(bars);
        const latestBar = bars[bars.length - 1];
        const targetHigh = swingHighs[swingHighs.length - 1];
        const distFromHigh = Math.abs(latestBar.high - targetHigh.price);
        if (distFromHigh > abs)
            return null;
        if (latestBar.close >= targetHigh.price)
            return null;
        if (latestBar.close >= latestBar.open)
            return null;
        const stopPrice = targetHigh.price + abs;
        const riskPerShare = stopPrice - latestBar.close;
        return {
            type: client_1.SetupType.DOUBLE_TOP,
            direction: 'SHORT',
            timeframe: 'DAILY',
            pivotPrice: targetHigh.price,
            stopPrice,
            targetPrice: riskPerShare > 0 ? latestBar.close - riskPerShare * 3 : undefined,
            riskReward: 3,
            evidence: ['failed_test_of_high'],
            metadata: {
                swingHighPrice: targetHigh.price,
                testHigh: latestBar.high,
                rejectionClose: latestBar.close,
            },
        };
    }
}
exports.DoubleTopDetector = DoubleTopDetector;
//# sourceMappingURL=double-top.detector.js.map