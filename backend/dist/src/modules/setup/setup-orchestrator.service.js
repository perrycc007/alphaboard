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
var SetupOrchestratorService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SetupOrchestratorService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const client_1 = require("@prisma/client");
const primitives_1 = require("./primitives");
const daily_base_detector_1 = require("./detectors/daily/daily-base.detector");
const vcp_detector_1 = require("./detectors/daily/vcp.detector");
const breakout_detector_1 = require("./detectors/daily/breakout.detector");
const fail_breakout_detector_1 = require("./detectors/daily/fail-breakout.detector");
const fail_base_detector_1 = require("./detectors/daily/fail-base.detector");
const momentum_detector_1 = require("./detectors/daily/momentum.detector");
const pullback_detector_1 = require("./detectors/daily/pullback.detector");
const undercut_rally_detector_1 = require("./detectors/daily/undercut-rally.detector");
const double_top_detector_1 = require("./detectors/daily/double-top.detector");
const intraday_base_detector_1 = require("./detectors/intraday/intraday-base.detector");
const cross620_detector_1 = require("./detectors/intraday/cross620.detector");
const gap_detector_1 = require("./detectors/intraday/gap.detector");
const tiring_down_detector_1 = require("./detectors/intraday/tiring-down.detector");
const confirmation_engine_1 = require("./confirmation/confirmation-engine");
let SetupOrchestratorService = SetupOrchestratorService_1 = class SetupOrchestratorService {
    prisma;
    logger = new common_1.Logger(SetupOrchestratorService_1.name);
    dailyDetectors = [
        new daily_base_detector_1.DailyBaseDetector(),
        new vcp_detector_1.VcpDetector(),
        new breakout_detector_1.BreakoutDetector(),
        new fail_breakout_detector_1.FailBreakoutDetector(),
        new fail_base_detector_1.FailBaseDetector(),
        new momentum_detector_1.MomentumContinuationDetector(),
        new pullback_detector_1.PullbackDetector(),
        new undercut_rally_detector_1.UndercutRallyDetector(),
        new double_top_detector_1.DoubleTopDetector(),
    ];
    intradayDetectors = [
        new intraday_base_detector_1.IntradayBaseDetector(),
        new cross620_detector_1.Cross620Detector(),
        new gap_detector_1.GapDetector(),
        new tiring_down_detector_1.TiringDownDetector(),
    ];
    constructor(prisma) {
        this.prisma = prisma;
    }
    async runDailyDetection(stockId, bars) {
        const swingPoints = (0, primitives_1.detectSwingPoints)(bars);
        const context = await this.buildDailyContext(stockId, bars);
        for (const detector of this.dailyDetectors) {
            const result = detector.detect(bars, swingPoints, context);
            if (result) {
                await this.persistSetup(stockId, result);
                this.logger.log(`Detected ${result.type} for stock ${stockId}`);
            }
        }
        await this.updateDailySetupStates(stockId, bars);
        await this.expireStaleSetups(stockId);
    }
    async processIntradayBar(stockId, bars, confirmContext) {
        const context = await this.buildDailyContext(stockId, bars);
        for (const detector of this.intradayDetectors) {
            const result = detector.detect(bars, context);
            if (result) {
                await this.persistSetup(stockId, result);
            }
        }
        if (bars.length >= 2) {
            const evidenceResults = (0, confirmation_engine_1.evaluateBar)(bars[bars.length - 1], bars[bars.length - 2], confirmContext);
            for (const ev of evidenceResults) {
                await this.prisma.barEvidence.create({
                    data: {
                        stockId,
                        timeframe: client_1.Timeframe.INTRADAY,
                        barDate: new Date(),
                        pattern: ev.pattern,
                        bias: ev.bias,
                        isViolation: ev.isViolation,
                        keyLevelType: ev.keyLevelType,
                        keyLevelPrice: ev.keyLevelPrice,
                        volumeState: ev.volumeState,
                    },
                });
            }
        }
    }
    async buildDailyContext(stockId, bars) {
        const latestStage = await this.prisma.stockStage.findFirst({
            where: { stockId },
            orderBy: { date: 'desc' },
        });
        const activeBases = await this.prisma.dailyBase.findMany({
            where: { stockId, status: { in: ['FORMING', 'COMPLETE'] } },
        });
        const activeSetups = await this.prisma.setup.findMany({
            where: {
                stockId,
                state: {
                    in: [
                        client_1.SetupState.BUILDING,
                        client_1.SetupState.READY,
                        client_1.SetupState.TRIGGERED,
                    ],
                },
            },
        });
        const latestDaily = await this.prisma.stockDaily.findFirst({
            where: { stockId },
            orderBy: { date: 'desc' },
        });
        const avgVolume = bars.length > 0
            ? bars.reduce((sum, b) => sum + b.volume, 0) / bars.length
            : 0;
        return {
            stockId,
            isStage2: latestStage?.stage === 'STAGE_2',
            sma50: latestDaily?.sma50 ? Number(latestDaily.sma50) : undefined,
            sma200: latestDaily?.sma200 ? Number(latestDaily.sma200) : undefined,
            avgVolume,
            activeBases: activeBases.map((b) => ({
                id: b.id,
                peakPrice: Number(b.peakPrice),
                baseLow: Number(b.baseLow),
                pivotPrice: b.pivotPrice ? Number(b.pivotPrice) : undefined,
                status: b.status,
            })),
            activeSetups: activeSetups.map((s) => ({
                id: s.id,
                type: s.type,
                state: s.state,
                pivotPrice: s.pivotPrice ? Number(s.pivotPrice) : undefined,
            })),
        };
    }
    async persistSetup(stockId, detected) {
        await this.prisma.setup.create({
            data: {
                stockId,
                type: detected.type,
                timeframe: detected.timeframe,
                direction: detected.direction,
                state: client_1.SetupState.BUILDING,
                pivotPrice: detected.pivotPrice,
                stopPrice: detected.stopPrice,
                targetPrice: detected.targetPrice,
                riskReward: detected.riskReward,
                evidence: detected.evidence ?? [],
                waitingFor: detected.waitingFor,
                metadata: detected.metadata ?? undefined,
                dailyBaseId: detected.dailyBaseId,
            },
        });
    }
    async updateDailySetupStates(stockId, bars) {
        if (bars.length === 0)
            return;
        const latestBar = bars[bars.length - 1];
        const abs = (0, primitives_1.averageBarSize)(bars);
        const activeSetups = await this.prisma.setup.findMany({
            where: {
                stockId,
                state: { in: [client_1.SetupState.BUILDING, client_1.SetupState.READY] },
            },
        });
        for (const setup of activeSetups) {
            let newState = null;
            if (setup.state === client_1.SetupState.BUILDING && setup.pivotPrice) {
                newState = client_1.SetupState.READY;
            }
            if (setup.state === client_1.SetupState.READY &&
                setup.pivotPrice &&
                latestBar.close > Number(setup.pivotPrice)) {
                newState = client_1.SetupState.TRIGGERED;
            }
            if (setup.stopPrice &&
                latestBar.close < Number(setup.stopPrice) - abs) {
                newState = client_1.SetupState.VIOLATED;
            }
            if (newState) {
                await this.prisma.setup.update({
                    where: { id: setup.id },
                    data: { state: newState, lastStateAt: new Date() },
                });
            }
        }
    }
    async expireStaleSetups(stockId) {
        await this.prisma.setup.updateMany({
            where: {
                stockId,
                state: { in: [client_1.SetupState.BUILDING, client_1.SetupState.READY] },
                expiresAt: { lt: new Date() },
            },
            data: { state: client_1.SetupState.EXPIRED, lastStateAt: new Date() },
        });
    }
    async getActiveSetups(filters) {
        return this.prisma.setup.findMany({
            where: {
                state: {
                    in: [
                        client_1.SetupState.BUILDING,
                        client_1.SetupState.READY,
                        client_1.SetupState.TRIGGERED,
                    ],
                },
                ...(filters?.type && { type: filters.type }),
                ...(filters?.direction && {
                    direction: filters.direction,
                }),
                ...(filters?.timeframe && { timeframe: filters.timeframe }),
            },
            include: { stock: true },
            orderBy: { detectedAt: 'desc' },
        });
    }
    async getSetupById(id) {
        return this.prisma.setup.findUniqueOrThrow({
            where: { id },
            include: {
                stock: true,
                barEvidence: { orderBy: { barDate: 'desc' } },
            },
        });
    }
};
exports.SetupOrchestratorService = SetupOrchestratorService;
exports.SetupOrchestratorService = SetupOrchestratorService = SetupOrchestratorService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], SetupOrchestratorService);
//# sourceMappingURL=setup-orchestrator.service.js.map