"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var StageRecalcJob_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.StageRecalcJob = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const prisma_service_1 = require("../../../prisma/prisma.service");
const stage_classifier_service_1 = require("../../stock/services/stage-classifier.service");
let StageRecalcJob = StageRecalcJob_1 = class StageRecalcJob {
    prisma;
    stageClassifier;
    logger = new common_1.Logger(StageRecalcJob_1.name);
    constructor(prisma, stageClassifier) {
        this.prisma = prisma;
        this.stageClassifier = stageClassifier;
    }
    async run() {
        this.logger.log('Starting stage recalculation...');
        const stocks = await this.prisma.stock.findMany({
            where: { isActive: true },
            select: { id: true, ticker: true },
        });
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        for (const stock of stocks) {
            try {
                const latestBar = await this.prisma.stockDaily.findFirst({
                    where: { stockId: stock.id },
                    orderBy: { date: 'desc' },
                });
                if (!latestBar?.sma50 ||
                    !latestBar?.sma150 ||
                    !latestBar?.sma200) {
                    continue;
                }
                const thirtyDaysAgo = new Date(today);
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                const oldBar = await this.prisma.stockDaily.findFirst({
                    where: { stockId: stock.id, date: { lte: thirtyDaysAgo } },
                    orderBy: { date: 'desc' },
                });
                const oneYearAgo = new Date(today);
                oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
                const yearBars = await this.prisma.stockDaily.findMany({
                    where: { stockId: stock.id, date: { gte: oneYearAgo } },
                    select: { high: true, low: true },
                });
                if (yearBars.length === 0)
                    continue;
                const high52w = Math.max(...yearBars.map((b) => Number(b.high)));
                const low52w = Math.min(...yearBars.map((b) => Number(b.low)));
                const classification = this.stageClassifier.classify(Number(latestBar.close), Number(latestBar.sma50), Number(latestBar.sma150), Number(latestBar.sma200), oldBar?.sma200 ? Number(oldBar.sma200) : Number(latestBar.sma200), high52w, low52w);
                await this.prisma.stockStage.upsert({
                    where: {
                        stockId_date: { stockId: stock.id, date: today },
                    },
                    create: {
                        stockId: stock.id,
                        date: today,
                        stage: classification.stage,
                        category: classification.category,
                        isTemplate: classification.isTemplate,
                        metadata: classification.criteria,
                    },
                    update: {
                        stage: classification.stage,
                        category: classification.category,
                        isTemplate: classification.isTemplate,
                        metadata: classification.criteria,
                    },
                });
            }
            catch (err) {
                this.logger.error(`Failed stage recalc for ${stock.ticker}`, err);
            }
        }
        this.logger.log('Stage recalculation complete');
    }
};
exports.StageRecalcJob = StageRecalcJob;
__decorate([
    (0, schedule_1.Cron)('30 17 * * 1-5'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], StageRecalcJob.prototype, "run", null);
exports.StageRecalcJob = StageRecalcJob = StageRecalcJob_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        stage_classifier_service_1.StageClassifierService])
], StageRecalcJob);
//# sourceMappingURL=stage-recalc.job.js.map