"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntradayBaseDetector = void 0;
const client_1 = require("@prisma/client");
const primitives_1 = require("../../primitives");
class IntradayBaseDetector {
    type = client_1.SetupType.INTRADAY_BASE;
    detect(bars, _dailyContext) {
        if (bars.length < 15)
            return null;
        const abs = (0, primitives_1.averageBarSize)(bars);
        const swings = (0, primitives_1.detectSwingPoints)(bars, 5);
        if (swings.length === 0)
            return null;
        const lastSwing = swings[swings.length - 1];
        const barsAfter = bars.slice(lastSwing.index);
        if (barsAfter.length < 10)
            return null;
        const isHigh = lastSwing.type === 'HIGH';
        const level = lastSwing.price;
        const buffer = abs * 0.5;
        let structureIntact = true;
        for (const bar of barsAfter) {
            if (isHigh && bar.high > level + buffer) {
                structureIntact = false;
                break;
            }
            if (!isHigh && bar.low < level - buffer) {
                structureIntact = false;
                break;
            }
        }
        if (!structureIntact)
            return null;
        const direction = isHigh ? 'SHORT' : 'LONG';
        const stopPrice = isHigh ? level + abs : level - abs;
        return {
            type: client_1.SetupType.INTRADAY_BASE,
            direction,
            timeframe: 'INTRADAY',
            pivotPrice: level,
            stopPrice,
            evidence: ['intraday_base_forming'],
            waitingFor: '620_cross',
            metadata: {
                swingType: lastSwing.type,
                swingPrice: level,
                barsInBase: barsAfter.length,
            },
        };
    }
    updateState(currentState, _latestBar, _context) {
        return currentState;
    }
}
exports.IntradayBaseDetector = IntradayBaseDetector;
//# sourceMappingURL=intraday-base.detector.js.map