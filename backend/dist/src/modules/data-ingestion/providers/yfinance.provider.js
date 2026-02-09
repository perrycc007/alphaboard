"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var YFinanceProvider_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.YFinanceProvider = void 0;
const common_1 = require("@nestjs/common");
const yahoo_finance2_1 = __importDefault(require("yahoo-finance2"));
const FETCH_TIMEOUT_MS = 15_000;
function withTimeout(promise, ms, label) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`Timeout after ${ms}ms for ${label}`)), ms);
        promise.then((val) => { clearTimeout(timer); resolve(val); }, (err) => { clearTimeout(timer); reject(err); });
    });
}
let YFinanceProvider = YFinanceProvider_1 = class YFinanceProvider {
    logger = new common_1.Logger(YFinanceProvider_1.name);
    yf = new yahoo_finance2_1.default({
        suppressNotices: ['ripHistorical'],
    });
    async fetchDailyBars(ticker, from, to) {
        try {
            if (from >= to) {
                return [];
            }
            const result = await withTimeout(this.yf.historical(ticker, {
                period1: from,
                period2: to,
                interval: '1d',
            }), FETCH_TIMEOUT_MS, ticker);
            const bars = result.map((row) => ({
                date: row.date,
                open: row.open,
                high: row.high,
                low: row.low,
                close: row.close,
                volume: row.volume,
            }));
            return bars;
        }
        catch (error) {
            this.logger.warn(`Failed ${ticker}: ${error.message}`);
            return [];
        }
    }
};
exports.YFinanceProvider = YFinanceProvider;
exports.YFinanceProvider = YFinanceProvider = YFinanceProvider_1 = __decorate([
    (0, common_1.Injectable)()
], YFinanceProvider);
//# sourceMappingURL=yfinance.provider.js.map