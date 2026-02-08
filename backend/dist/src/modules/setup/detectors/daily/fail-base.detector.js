"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FailBaseDetector = void 0;
const client_1 = require("@prisma/client");
const primitives_1 = require("../../primitives");
class FailBaseDetector {
    type = client_1.SetupType.FAIL_BASE;
    detect(bars, _swingPoints, context) {
        if (bars.length < 3)
            return null;
        if (!context.sma50)
            return null;
        const activeVcp = context.activeSetups?.find((s) => s.type === client_1.SetupType.VCP &&
            (s.state === 'BUILDING' || s.state === 'READY'));
        if (!activeVcp)
            return null;
        const sma50 = context.sma50;
        const abs = (0, primitives_1.averageBarSize)(bars);
        const latestBar = bars[bars.length - 1];
        const prevBar = bars[bars.length - 2];
        if (latestBar.close >= sma50)
            return null;
        const distanceBelow = sma50 - latestBar.close;
        const twoConsecutive = prevBar.close < sma50 && latestBar.close < sma50;
        const singleStrong = distanceBelow > 0.5 * abs;
        if (!twoConsecutive && !singleStrong)
            return null;
        return {
            type: client_1.SetupType.FAIL_BASE,
            direction: 'SHORT',
            timeframe: 'DAILY',
            pivotPrice: sma50,
            stopPrice: sma50 + abs,
            evidence: [
                twoConsecutive ? 'two_consecutive_below_50ma' : 'strong_close_below_50ma',
            ],
            metadata: {
                sma50,
                failureClose: latestBar.close,
                distanceBelow: Math.round(distanceBelow * 100) / 100,
                vcpSetupId: activeVcp.id,
            },
        };
    }
}
exports.FailBaseDetector = FailBaseDetector;
//# sourceMappingURL=fail-base.detector.js.map