"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.averageBarSize = averageBarSize;
function averageBarSize(bars, period = 20) {
    if (bars.length === 0)
        return 0;
    const slice = bars.slice(-period);
    const sum = slice.reduce((acc, bar) => acc + (bar.high - bar.low), 0);
    return sum / slice.length;
}
//# sourceMappingURL=average-bar-size.js.map