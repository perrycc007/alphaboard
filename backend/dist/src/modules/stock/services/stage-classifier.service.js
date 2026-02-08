"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StageClassifierService = void 0;
exports.classifyStage = classifyStage;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
function classifyStage(currentPrice, sma50, sma150, sma200, sma200_30dAgo, high52w, low52w) {
    const criteria = {
        priceAbove150and200: currentPrice > sma150 && currentPrice > sma200,
        ma150Above200: sma150 > sma200,
        ma200TrendingUp: sma200 > sma200_30dAgo,
        ma50Above150and200: sma50 > sma150 && sma50 > sma200,
        priceAbove50: currentPrice > sma50,
        above30PctFrom52wLow: currentPrice >= low52w * 1.3,
        within25PctOf52wHigh: currentPrice >= high52w * 0.75,
    };
    const allCriteriaMet = Object.values(criteria).every(Boolean);
    let stage;
    if (allCriteriaMet) {
        stage = client_1.StageEnum.STAGE_2;
    }
    else if (currentPrice > sma200 && sma200 > sma200_30dAgo) {
        stage = client_1.StageEnum.STAGE_1;
    }
    else if (currentPrice < sma200 && sma200 < sma200_30dAgo) {
        stage = client_1.StageEnum.STAGE_4;
    }
    else {
        stage = client_1.StageEnum.STAGE_3;
    }
    const category = stage === client_1.StageEnum.STAGE_2
        ? client_1.StockCategory.HOT
        : criteria.priceAbove150and200 && criteria.ma50Above150and200
            ? client_1.StockCategory.FORMER_HOT
            : client_1.StockCategory.NONE;
    return {
        stage,
        category,
        isTemplate: allCriteriaMet,
        criteria,
    };
}
let StageClassifierService = class StageClassifierService {
    classify(currentPrice, sma50, sma150, sma200, sma200_30dAgo, high52w, low52w) {
        return classifyStage(currentPrice, sma50, sma150, sma200, sma200_30dAgo, high52w, low52w);
    }
};
exports.StageClassifierService = StageClassifierService;
exports.StageClassifierService = StageClassifierService = __decorate([
    (0, common_1.Injectable)()
], StageClassifierService);
//# sourceMappingURL=stage-classifier.service.js.map