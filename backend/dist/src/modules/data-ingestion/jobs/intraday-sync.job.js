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
var IntradaySyncJob_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntradaySyncJob = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const prisma_service_1 = require("../../../prisma/prisma.service");
const polygon_provider_1 = require("../providers/polygon.provider");
const setup_orchestrator_service_1 = require("../../setup/setup-orchestrator.service");
const alert_gateway_1 = require("../../alert/alert.gateway");
let IntradaySyncJob = IntradaySyncJob_1 = class IntradaySyncJob {
    prisma;
    polygon;
    orchestrator;
    alertGateway;
    logger = new common_1.Logger(IntradaySyncJob_1.name);
    constructor(prisma, polygon, orchestrator, alertGateway) {
        this.prisma = prisma;
        this.polygon = polygon;
        this.orchestrator = orchestrator;
        this.alertGateway = alertGateway;
    }
    async run() {
        const stocks = await this.prisma.stock.findMany({
            where: { isActive: true },
            select: { id: true, ticker: true },
        });
        const today = new Date();
        for (const stock of stocks) {
            try {
                const bars = await this.polygon.fetchIntradayBars(stock.ticker, today);
                for (const bar of bars) {
                    await this.prisma.stockIntraday.upsert({
                        where: {
                            stockId_timestamp: {
                                stockId: stock.id,
                                timestamp: bar.timestamp,
                            },
                        },
                        create: {
                            stockId: stock.id,
                            timestamp: bar.timestamp,
                            open: bar.open,
                            high: bar.high,
                            low: bar.low,
                            close: bar.close,
                            volume: BigInt(Math.round(bar.volume)),
                        },
                        update: {
                            open: bar.open,
                            high: bar.high,
                            low: bar.low,
                            close: bar.close,
                            volume: BigInt(Math.round(bar.volume)),
                        },
                    });
                    this.alertGateway.sendIntradayBar(stock.ticker, {
                        timestamp: bar.timestamp,
                        open: bar.open,
                        high: bar.high,
                        low: bar.low,
                        close: bar.close,
                        volume: bar.volume,
                    });
                }
                if (bars.length > 0) {
                    const intradayBars = bars.map((b) => ({
                        open: b.open,
                        high: b.high,
                        low: b.low,
                        close: b.close,
                        volume: b.volume,
                        timestamp: b.timestamp,
                    }));
                    await this.orchestrator.processIntradayBar(stock.id, intradayBars, {
                        swingPoints: [],
                        bases: [],
                        indicators: {},
                        avgVolume: 0,
                        avgRange: 0,
                    });
                }
            }
            catch (err) {
                this.logger.error(`Failed intraday sync for ${stock.ticker}`, err);
            }
        }
    }
};
exports.IntradaySyncJob = IntradaySyncJob;
__decorate([
    (0, schedule_1.Cron)('*/5 9-16 * * 1-5'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], IntradaySyncJob.prototype, "run", null);
exports.IntradaySyncJob = IntradaySyncJob = IntradaySyncJob_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        polygon_provider_1.PolygonProvider,
        setup_orchestrator_service_1.SetupOrchestratorService,
        alert_gateway_1.AlertGateway])
], IntradaySyncJob);
//# sourceMappingURL=intraday-sync.job.js.map