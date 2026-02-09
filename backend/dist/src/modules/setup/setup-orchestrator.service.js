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
const high_tight_flag_detector_1 = require("./detectors/daily/high-tight-flag.detector");
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
        new high_tight_flag_detector_1.HighTightFlagDetector(),
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
            atr14: latestDaily?.atr14 ? Number(latestDaily.atr14) : undefined,
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
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 42);
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
                expiresAt,
            },
        });
    }
    async updateDailySetupStates(stockId, bars) {
        if (bars.length === 0)
            return;
        const latestBar = bars[bars.length - 1];
        const abs = (0, primitives_1.averageBarSize)(bars);
        const proximityThreshold = 1.5 * abs;
        const pendingSetups = await this.prisma.setup.findMany({
            where: {
                stockId,
                state: { in: [client_1.SetupState.BUILDING, client_1.SetupState.READY] },
            },
        });
        for (const setup of pendingSetups) {
            let newState = null;
            let stateReason;
            if (setup.state === client_1.SetupState.BUILDING && setup.pivotPrice) {
                newState = client_1.SetupState.READY;
                stateReason = 'pivot_identified';
            }
            if (setup.state === client_1.SetupState.READY && setup.pivotPrice) {
                const pivot = Number(setup.pivotPrice);
                if (setup.direction === 'LONG' && latestBar.close > pivot) {
                    newState = client_1.SetupState.TRIGGERED;
                    stateReason = 'breakout_above_pivot';
                }
                else if (setup.direction === 'SHORT' && latestBar.close < pivot) {
                    newState = client_1.SetupState.TRIGGERED;
                    stateReason = 'breakdown_below_pivot';
                }
            }
            if (setup.stopPrice) {
                const stop = Number(setup.stopPrice);
                if (setup.direction === 'LONG' && latestBar.close < stop - abs) {
                    newState = client_1.SetupState.VIOLATED;
                    stateReason = 'stop_violated';
                }
                else if (setup.direction === 'SHORT' &&
                    latestBar.close > stop + abs) {
                    newState = client_1.SetupState.VIOLATED;
                    stateReason = 'stop_violated';
                }
            }
            if (!newState &&
                setup.pivotPrice &&
                (setup.state === client_1.SetupState.BUILDING ||
                    setup.state === client_1.SetupState.READY)) {
                const pivot = Number(setup.pivotPrice);
                const distFromPivot = Math.abs(latestBar.close - pivot);
                if (distFromPivot > proximityThreshold) {
                    const priceMovedAway = (setup.direction === 'LONG' && latestBar.close < pivot - proximityThreshold) ||
                        (setup.direction === 'SHORT' && latestBar.close > pivot + proximityThreshold);
                    if (priceMovedAway) {
                        newState = client_1.SetupState.EXPIRED;
                        stateReason = 'expired_distance';
                    }
                }
            }
            if (newState) {
                const existingMeta = setup.metadata ?? {};
                await this.prisma.setup.update({
                    where: { id: setup.id },
                    data: {
                        state: newState,
                        lastStateAt: new Date(),
                        metadata: { ...existingMeta, stateReason },
                    },
                });
            }
        }
        const triggeredSetups = await this.prisma.setup.findMany({
            where: {
                stockId,
                state: client_1.SetupState.TRIGGERED,
            },
        });
        for (const setup of triggeredSetups) {
            let newState = null;
            let stateReason;
            if (setup.stopPrice) {
                const stop = Number(setup.stopPrice);
                if (setup.direction === 'LONG' && latestBar.close < stop) {
                    newState = client_1.SetupState.VIOLATED;
                    stateReason = 'stop_hit_after_trigger';
                }
                else if (setup.direction === 'SHORT' && latestBar.close > stop) {
                    newState = client_1.SetupState.VIOLATED;
                    stateReason = 'stop_hit_after_trigger';
                }
            }
            if (!newState && setup.targetPrice) {
                const target = Number(setup.targetPrice);
                if (setup.direction === 'LONG' && latestBar.close >= target) {
                    newState = client_1.SetupState.EXPIRED;
                    stateReason = 'target_reached';
                }
                else if (setup.direction === 'SHORT' && latestBar.close <= target) {
                    newState = client_1.SetupState.EXPIRED;
                    stateReason = 'target_reached';
                }
            }
            if (!newState && setup.pivotPrice) {
                const pivot = Number(setup.pivotPrice);
                const farThreshold = 3 * abs;
                if (setup.direction === 'LONG' && latestBar.close > pivot + farThreshold) {
                    newState = client_1.SetupState.EXPIRED;
                    stateReason = 'left_entry_area';
                }
                else if (setup.direction === 'SHORT' &&
                    latestBar.close < pivot - farThreshold) {
                    newState = client_1.SetupState.EXPIRED;
                    stateReason = 'left_entry_area';
                }
            }
            if (newState) {
                const existingMeta = setup.metadata ?? {};
                await this.prisma.setup.update({
                    where: { id: setup.id },
                    data: {
                        state: newState,
                        lastStateAt: new Date(),
                        metadata: { ...existingMeta, stateReason },
                    },
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
    async simulateDetection(ticker, fromDate) {
        const stock = await this.prisma.stock.findUniqueOrThrow({
            where: { ticker: ticker.toUpperCase() },
        });
        const where = { stockId: stock.id };
        if (fromDate) {
            where.date = { gte: fromDate };
        }
        const dailyBars = await this.prisma.stockDaily.findMany({
            where,
            orderBy: { date: 'asc' },
        });
        if (dailyBars.length < 50)
            return [];
        const bars = dailyBars.map((b) => ({
            open: Number(b.open),
            high: Number(b.high),
            low: Number(b.low),
            close: Number(b.close),
            volume: Number(b.volume),
            date: b.date,
        }));
        const results = [];
        const windowSize = 252;
        const minBars = 50;
        const activeSimSetups = [];
        for (let i = minBars; i <= bars.length; i++) {
            const windowStart = Math.max(0, i - windowSize);
            const windowBars = bars.slice(windowStart, i);
            const latestBar = windowBars[windowBars.length - 1];
            const abs = (0, primitives_1.averageBarSize)(windowBars);
            const swingPoints = (0, primitives_1.detectSwingPoints)(windowBars);
            const sma50 = dailyBars[i - 1]?.sma50
                ? Number(dailyBars[i - 1].sma50)
                : undefined;
            const sma200 = dailyBars[i - 1]?.sma200
                ? Number(dailyBars[i - 1].sma200)
                : undefined;
            const isStage2 = sma50 != null &&
                sma200 != null &&
                latestBar.close > sma50 &&
                sma50 > sma200;
            const atr14 = dailyBars[i - 1]?.atr14
                ? Number(dailyBars[i - 1].atr14)
                : undefined;
            const simContext = {
                stockId: stock.id,
                isStage2,
                sma50,
                sma200,
                atr14,
                avgVolume: windowBars.reduce((sum, b) => sum + b.volume, 0) /
                    windowBars.length,
                activeBases: [],
                activeSetups: activeSimSetups
                    .filter((s) => s.state === 'BUILDING' || s.state === 'READY')
                    .map((s) => ({
                    id: s.id,
                    type: s.type,
                    state: s.state,
                    pivotPrice: s.pivotPrice ?? undefined,
                })),
            };
            for (const detector of this.dailyDetectors) {
                const result = detector.detect(windowBars, swingPoints, simContext);
                if (result) {
                    const tradeCategory = BREAKOUT_TYPES.includes(result.type)
                        ? 'BREAKOUT'
                        : REVERSAL_TYPES.includes(result.type)
                            ? 'REVERSAL'
                            : null;
                    const simSetup = {
                        id: `sim-${results.length}`,
                        type: result.type,
                        direction: result.direction,
                        state: 'BUILDING',
                        detectedAt: latestBar.date?.toISOString() ?? '',
                        pivotPrice: result.pivotPrice ?? null,
                        stopPrice: result.stopPrice ?? null,
                        targetPrice: result.targetPrice ?? null,
                        riskReward: result.riskReward ?? null,
                        evidence: result.evidence ?? [],
                        metadata: result.metadata ?? {},
                        stateHistory: [
                            {
                                state: 'BUILDING',
                                date: latestBar.date?.toISOString() ?? '',
                            },
                        ],
                        tradeCategory,
                        entryPrice: null,
                        entryDate: null,
                        exitPrice: null,
                        exitDate: null,
                        actualStopPrice: null,
                        riskAmount: null,
                        maxR: null,
                        maxPct: null,
                        finalR: null,
                        finalPct: null,
                        holdingDays: null,
                    };
                    if (simSetup.pivotPrice) {
                        simSetup.state = 'READY';
                        simSetup.stateHistory.push({
                            state: 'READY',
                            date: latestBar.date?.toISOString() ?? '',
                        });
                    }
                    results.push(simSetup);
                    activeSimSetups.push(simSetup);
                }
            }
            for (const setup of activeSimSetups) {
                if (setup.state === 'EXPIRED' || setup.state === 'VIOLATED')
                    continue;
                const dateStr = latestBar.date?.toISOString() ?? '';
                if (setup.state === 'READY' && setup.pivotPrice) {
                    const triggered = (setup.direction === 'LONG' &&
                        latestBar.close > setup.pivotPrice) ||
                        (setup.direction === 'SHORT' &&
                            latestBar.close < setup.pivotPrice);
                    if (triggered) {
                        setup.state = 'TRIGGERED';
                        setup.entryPrice = setup.pivotPrice;
                        setup.entryDate = dateStr;
                        if (setup.tradeCategory === 'BREAKOUT') {
                            setup.actualStopPrice = setup.stopPrice;
                        }
                        else {
                            setup.actualStopPrice =
                                setup.direction === 'LONG'
                                    ? latestBar.low
                                    : latestBar.high;
                        }
                        setup.riskAmount =
                            setup.entryPrice != null && setup.actualStopPrice != null
                                ? Math.abs(setup.entryPrice - setup.actualStopPrice)
                                : null;
                        setup.stateHistory.push({ state: 'TRIGGERED', date: dateStr });
                        continue;
                    }
                }
                if ((setup.state === 'BUILDING' || setup.state === 'READY') &&
                    setup.stopPrice) {
                    const violated = (setup.direction === 'LONG' &&
                        latestBar.close < setup.stopPrice - abs) ||
                        (setup.direction === 'SHORT' &&
                            latestBar.close > setup.stopPrice + abs);
                    if (violated) {
                        setup.state = 'VIOLATED';
                        setup.stateHistory.push({ state: 'VIOLATED', date: dateStr });
                        continue;
                    }
                }
                if ((setup.state === 'BUILDING' || setup.state === 'READY') &&
                    setup.pivotPrice) {
                    const proximityThreshold = 1.5 * abs;
                    const farAway = (setup.direction === 'LONG' &&
                        latestBar.close < setup.pivotPrice - proximityThreshold) ||
                        (setup.direction === 'SHORT' &&
                            latestBar.close > setup.pivotPrice + proximityThreshold);
                    if (farAway) {
                        setup.state = 'EXPIRED';
                        setup.stateHistory.push({ state: 'EXPIRED', date: dateStr });
                        continue;
                    }
                }
                if (setup.state === 'TRIGGERED' &&
                    setup.entryPrice != null &&
                    setup.riskAmount != null &&
                    setup.riskAmount > 0) {
                    if (setup.direction === 'LONG') {
                        const barMaxR = (latestBar.high - setup.entryPrice) / setup.riskAmount;
                        const barMaxPct = ((latestBar.high - setup.entryPrice) / setup.entryPrice) * 100;
                        setup.maxR = Math.max(setup.maxR ?? 0, barMaxR);
                        setup.maxPct = Math.max(setup.maxPct ?? 0, barMaxPct);
                    }
                    else {
                        const barMaxR = (setup.entryPrice - latestBar.low) / setup.riskAmount;
                        const barMaxPct = ((setup.entryPrice - latestBar.low) / setup.entryPrice) * 100;
                        setup.maxR = Math.max(setup.maxR ?? 0, barMaxR);
                        setup.maxPct = Math.max(setup.maxPct ?? 0, barMaxPct);
                    }
                    let exited = false;
                    if (setup.actualStopPrice != null) {
                        const stopHit = (setup.direction === 'LONG' &&
                            latestBar.close < setup.actualStopPrice) ||
                            (setup.direction === 'SHORT' &&
                                latestBar.close > setup.actualStopPrice);
                        if (stopHit) {
                            setup.state = 'VIOLATED';
                            exited = true;
                        }
                    }
                    if (!exited && setup.targetPrice != null) {
                        const targetHit = (setup.direction === 'LONG' &&
                            latestBar.close >= setup.targetPrice) ||
                            (setup.direction === 'SHORT' &&
                                latestBar.close <= setup.targetPrice);
                        if (targetHit) {
                            setup.state = 'EXPIRED';
                            exited = true;
                        }
                    }
                    if (exited) {
                        setup.exitPrice = latestBar.close;
                        setup.exitDate = dateStr;
                        if (setup.direction === 'LONG') {
                            setup.finalR =
                                (latestBar.close - setup.entryPrice) / setup.riskAmount;
                            setup.finalPct =
                                ((latestBar.close - setup.entryPrice) / setup.entryPrice) *
                                    100;
                        }
                        else {
                            setup.finalR =
                                (setup.entryPrice - latestBar.close) / setup.riskAmount;
                            setup.finalPct =
                                ((setup.entryPrice - latestBar.close) / setup.entryPrice) *
                                    100;
                        }
                        if (setup.entryDate) {
                            const entryTime = new Date(setup.entryDate).getTime();
                            const exitTime = new Date(dateStr).getTime();
                            setup.holdingDays = Math.round((exitTime - entryTime) / (1000 * 60 * 60 * 24));
                        }
                        setup.stateHistory.push({ state: setup.state, date: dateStr });
                        continue;
                    }
                }
            }
        }
        return results;
    }
};
exports.SetupOrchestratorService = SetupOrchestratorService;
exports.SetupOrchestratorService = SetupOrchestratorService = SetupOrchestratorService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], SetupOrchestratorService);
const BREAKOUT_TYPES = [
    'VCP',
    'BREAKOUT_PIVOT',
    'HIGH_TIGHT_FLAG',
    'PULLBACK_BUY',
];
const REVERSAL_TYPES = [
    'UNDERCUT_RALLY',
    'DOUBLE_TOP',
    'FAIL_BASE',
    'FAIL_BREAKOUT',
];
//# sourceMappingURL=setup-orchestrator.service.js.map