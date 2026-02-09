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
var SetupScanJob_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SetupScanJob = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const prisma_service_1 = require("../../../prisma/prisma.service");
const setup_orchestrator_service_1 = require("../../setup/setup-orchestrator.service");
let SetupScanJob = SetupScanJob_1 = class SetupScanJob {
    prisma;
    orchestrator;
    logger = new common_1.Logger(SetupScanJob_1.name);
    constructor(prisma, orchestrator) {
        this.prisma = prisma;
        this.orchestrator = orchestrator;
    }
    async run() {
        this.logger.log('Starting setup scan...');
        const candidates = await this.getSetupCandidates();
        this.logger.log(`Found ${candidates.length} setup candidates after filtering`);
        for (const stock of candidates) {
            try {
                const dailyBars = await this.prisma.stockDaily.findMany({
                    where: { stockId: stock.id },
                    orderBy: { date: 'asc' },
                    take: 252,
                });
                if (dailyBars.length < 50)
                    continue;
                const bars = dailyBars.map((b) => ({
                    open: Number(b.open),
                    high: Number(b.high),
                    low: Number(b.low),
                    close: Number(b.close),
                    volume: Number(b.volume),
                    date: b.date,
                }));
                await this.orchestrator.runDailyDetection(stock.id, bars);
            }
            catch (err) {
                this.logger.error(`Failed setup scan for ${stock.ticker}`, err);
            }
        }
        this.logger.log('Setup scan complete');
    }
    async getSetupCandidates() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const candidates = await this.prisma.stock.findMany({
            where: {
                isActive: true,
                avgVolume: { gte: 200_000 },
                OR: [
                    {
                        stages: {
                            some: {
                                stage: 'STAGE_2',
                            },
                        },
                    },
                    {
                        stages: {
                            some: {
                                category: 'FORMER_HOT',
                            },
                        },
                    },
                    { sector: { in: ['Energy', 'Materials'] } },
                    { industry: { contains: 'Biotech' } },
                    { industry: { contains: 'Pharma' } },
                ],
            },
            select: { id: true, ticker: true },
        });
        const filtered = [];
        for (const stock of candidates) {
            const latestBar = await this.prisma.stockDaily.findFirst({
                where: { stockId: stock.id },
                orderBy: { date: 'desc' },
                select: { close: true },
            });
            if (latestBar && Number(latestBar.close) >= 5.0) {
                filtered.push(stock);
            }
        }
        return filtered;
    }
};
exports.SetupScanJob = SetupScanJob;
__decorate([
    (0, schedule_1.Cron)('0 18 * * 1-5'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SetupScanJob.prototype, "run", null);
exports.SetupScanJob = SetupScanJob = SetupScanJob_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        setup_orchestrator_service_1.SetupOrchestratorService])
], SetupScanJob);
//# sourceMappingURL=setup-scan.job.js.map