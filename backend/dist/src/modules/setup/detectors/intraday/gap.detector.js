"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GapDetector = void 0;
const client_1 = require("@prisma/client");
const primitives_1 = require("../../primitives");
class GapDetector {
    type = client_1.SetupType.GAP_UP;
    detect(bars, _dailyContext) {
        if (bars.length < 2)
            return null;
        const prevBar = bars[bars.length - 2];
        const currBar = bars[bars.length - 1];
        const abs = (0, primitives_1.averageBarSize)(bars);
        const gapUp = currBar.open > prevBar.high + abs * 0.5;
        const gapDown = currBar.open < prevBar.low - abs * 0.5;
        if (!gapUp && !gapDown)
            return null;
        const gapSize = gapUp
            ? currBar.open - prevBar.high
            : prevBar.low - currBar.open;
        const gapPercent = gapSize / prevBar.close;
        if (gapPercent < 0.01)
            return null;
        return {
            type: gapUp ? client_1.SetupType.GAP_UP : client_1.SetupType.GAP_DOWN,
            direction: gapUp ? 'LONG' : 'SHORT',
            timeframe: 'INTRADAY',
            pivotPrice: currBar.open,
            evidence: [gapUp ? 'gap_up' : 'gap_down'],
            waitingFor: '620_cross',
            metadata: {
                gapSize: Math.round(gapSize * 100) / 100,
                gapPercent: Math.round(gapPercent * 10000) / 100,
                prevClose: prevBar.close,
                openPrice: currBar.open,
            },
        };
    }
}
exports.GapDetector = GapDetector;
//# sourceMappingURL=gap.detector.js.map