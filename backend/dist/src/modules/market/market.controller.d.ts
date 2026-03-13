import { MarketService } from './market.service';
import { BreadthService } from './breadth.service';
import { MarketRegimeService } from './market-regime.service';
import { MarketPeriodGranularity } from '@prisma/client';
export declare class MarketController {
    private readonly marketService;
    private readonly breadthService;
    private readonly marketRegimeService;
    constructor(marketService: MarketService, breadthService: BreadthService, marketRegimeService: MarketRegimeService);
    getOverview(): Promise<{
        indices: {
            ticker: string;
            name: string;
            latest: {
                id: string;
                date: Date;
                indexId: string;
                open: import("@prisma/client-runtime-utils").Decimal;
                high: import("@prisma/client-runtime-utils").Decimal;
                low: import("@prisma/client-runtime-utils").Decimal;
                close: import("@prisma/client-runtime-utils").Decimal;
                volume: bigint;
            };
        }[];
        breadth: {
            id: string;
            date: Date;
            naad: import("@prisma/client-runtime-utils").Decimal | null;
            naa50r: import("@prisma/client-runtime-utils").Decimal | null;
            naa200r: import("@prisma/client-runtime-utils").Decimal | null;
            nahl: import("@prisma/client-runtime-utils").Decimal | null;
            avgWeightIdx: import("@prisma/client-runtime-utils").Decimal | null;
        } | null;
        timestamp: string;
    }>;
    getBreadthTimeSeries(range?: string): Promise<{
        id: string;
        date: Date;
        naad: import("@prisma/client-runtime-utils").Decimal | null;
        naa50r: import("@prisma/client-runtime-utils").Decimal | null;
        naa200r: import("@prisma/client-runtime-utils").Decimal | null;
        nahl: import("@prisma/client-runtime-utils").Decimal | null;
        avgWeightIdx: import("@prisma/client-runtime-utils").Decimal | null;
    }[]>;
    getIndexDaily(ticker: string, range?: string): Promise<{
        id: string;
        date: Date;
        indexId: string;
        open: import("@prisma/client-runtime-utils").Decimal;
        high: import("@prisma/client-runtime-utils").Decimal;
        low: import("@prisma/client-runtime-utils").Decimal;
        close: import("@prisma/client-runtime-utils").Decimal;
        volume: bigint;
    }[]>;
    getRegimes(from?: string, to?: string, granularity?: MarketPeriodGranularity): Promise<{
        leaderSnapshots: {
            stock: {
                ticker: string;
                name: string;
            };
            id: string;
            createdAt: Date;
            updatedAt: Date;
            timingSignals: import("@prisma/client/runtime/client").JsonValue;
            stockId: string;
            activeSetups: import("@prisma/client/runtime/client").JsonValue;
            marketRegimePeriodId: string;
            leaderRunId: string;
            periodStartDate: Date;
            periodEndDate: Date;
            stageAtPeriodStart: import("@prisma/client").$Enums.StageEnum | null;
            stageAtPeriodEnd: import("@prisma/client").$Enums.StageEnum | null;
            activity: import("@prisma/client").$Enums.LeaderPeriodActivity;
            activityNote: string | null;
            identifiedSetupLabel: string | null;
            primarySetupType: import("@prisma/client").$Enums.SetupType | null;
            primarySetupDirection: import("@prisma/client").$Enums.Direction | null;
            primarySetupState: import("@prisma/client").$Enums.SetupState | null;
            setupCount: number;
            timingSignalCount: number;
            startClose: import("@prisma/client-runtime-utils").Decimal | null;
            endClose: import("@prisma/client-runtime-utils").Decimal | null;
            periodReturnPct: import("@prisma/client-runtime-utils").Decimal | null;
            shortingEnabled: boolean;
        }[];
        id: string;
        createdAt: Date;
        updatedAt: Date;
        granularity: import("@prisma/client").$Enums.MarketPeriodGranularity;
        periodKey: string;
        startDate: Date;
        endDate: Date;
        label: import("@prisma/client").$Enums.MarketRegimeLabel;
        liveSampleCount: number;
        simulatedSampleCount: number;
        sourcePeriodCount: number;
        scorecard: import("@prisma/client/runtime/client").JsonValue;
        proxyStates: import("@prisma/client/runtime/client").JsonValue;
        leaderSummary: import("@prisma/client/runtime/client").JsonValue;
        markdown: string | null;
    }[]>;
    getRegimeReport(from?: string, to?: string, format?: string, granularity?: MarketPeriodGranularity): Promise<{
        leaderSnapshots: {
            stock: {
                ticker: string;
                name: string;
            };
            id: string;
            createdAt: Date;
            updatedAt: Date;
            timingSignals: import("@prisma/client/runtime/client").JsonValue;
            stockId: string;
            activeSetups: import("@prisma/client/runtime/client").JsonValue;
            marketRegimePeriodId: string;
            leaderRunId: string;
            periodStartDate: Date;
            periodEndDate: Date;
            stageAtPeriodStart: import("@prisma/client").$Enums.StageEnum | null;
            stageAtPeriodEnd: import("@prisma/client").$Enums.StageEnum | null;
            activity: import("@prisma/client").$Enums.LeaderPeriodActivity;
            activityNote: string | null;
            identifiedSetupLabel: string | null;
            primarySetupType: import("@prisma/client").$Enums.SetupType | null;
            primarySetupDirection: import("@prisma/client").$Enums.Direction | null;
            primarySetupState: import("@prisma/client").$Enums.SetupState | null;
            setupCount: number;
            timingSignalCount: number;
            startClose: import("@prisma/client-runtime-utils").Decimal | null;
            endClose: import("@prisma/client-runtime-utils").Decimal | null;
            periodReturnPct: import("@prisma/client-runtime-utils").Decimal | null;
            shortingEnabled: boolean;
        }[];
        id: string;
        createdAt: Date;
        updatedAt: Date;
        granularity: import("@prisma/client").$Enums.MarketPeriodGranularity;
        periodKey: string;
        startDate: Date;
        endDate: Date;
        label: import("@prisma/client").$Enums.MarketRegimeLabel;
        liveSampleCount: number;
        simulatedSampleCount: number;
        sourcePeriodCount: number;
        scorecard: import("@prisma/client/runtime/client").JsonValue;
        proxyStates: import("@prisma/client/runtime/client").JsonValue;
        leaderSummary: import("@prisma/client/runtime/client").JsonValue;
        markdown: string | null;
    }[] | {
        format: string;
        content: string;
    }>;
    getLeaderTimeline(ticker: string, from?: string, to?: string, granularity?: MarketPeriodGranularity): Promise<({
        leaderSnapshots: ({
            stock: {
                ticker: string;
                name: string;
            };
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            timingSignals: import("@prisma/client/runtime/client").JsonValue;
            stockId: string;
            activeSetups: import("@prisma/client/runtime/client").JsonValue;
            marketRegimePeriodId: string;
            leaderRunId: string;
            periodStartDate: Date;
            periodEndDate: Date;
            stageAtPeriodStart: import("@prisma/client").$Enums.StageEnum | null;
            stageAtPeriodEnd: import("@prisma/client").$Enums.StageEnum | null;
            activity: import("@prisma/client").$Enums.LeaderPeriodActivity;
            activityNote: string | null;
            identifiedSetupLabel: string | null;
            primarySetupType: import("@prisma/client").$Enums.SetupType | null;
            primarySetupDirection: import("@prisma/client").$Enums.Direction | null;
            primarySetupState: import("@prisma/client").$Enums.SetupState | null;
            setupCount: number;
            timingSignalCount: number;
            startClose: import("@prisma/client-runtime-utils").Decimal | null;
            endClose: import("@prisma/client-runtime-utils").Decimal | null;
            periodReturnPct: import("@prisma/client-runtime-utils").Decimal | null;
            shortingEnabled: boolean;
        })[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        granularity: import("@prisma/client").$Enums.MarketPeriodGranularity;
        periodKey: string;
        startDate: Date;
        endDate: Date;
        label: import("@prisma/client").$Enums.MarketRegimeLabel;
        liveSampleCount: number;
        simulatedSampleCount: number;
        sourcePeriodCount: number;
        scorecard: import("@prisma/client/runtime/client").JsonValue;
        proxyStates: import("@prisma/client/runtime/client").JsonValue;
        leaderSummary: import("@prisma/client/runtime/client").JsonValue;
        markdown: string | null;
    })[]>;
    getRegimeById(id: string): Promise<{
        leaderSnapshots: ({
            stock: {
                ticker: string;
                name: string;
            };
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            timingSignals: import("@prisma/client/runtime/client").JsonValue;
            stockId: string;
            activeSetups: import("@prisma/client/runtime/client").JsonValue;
            marketRegimePeriodId: string;
            leaderRunId: string;
            periodStartDate: Date;
            periodEndDate: Date;
            stageAtPeriodStart: import("@prisma/client").$Enums.StageEnum | null;
            stageAtPeriodEnd: import("@prisma/client").$Enums.StageEnum | null;
            activity: import("@prisma/client").$Enums.LeaderPeriodActivity;
            activityNote: string | null;
            identifiedSetupLabel: string | null;
            primarySetupType: import("@prisma/client").$Enums.SetupType | null;
            primarySetupDirection: import("@prisma/client").$Enums.Direction | null;
            primarySetupState: import("@prisma/client").$Enums.SetupState | null;
            setupCount: number;
            timingSignalCount: number;
            startClose: import("@prisma/client-runtime-utils").Decimal | null;
            endClose: import("@prisma/client-runtime-utils").Decimal | null;
            periodReturnPct: import("@prisma/client-runtime-utils").Decimal | null;
            shortingEnabled: boolean;
        })[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        granularity: import("@prisma/client").$Enums.MarketPeriodGranularity;
        periodKey: string;
        startDate: Date;
        endDate: Date;
        label: import("@prisma/client").$Enums.MarketRegimeLabel;
        liveSampleCount: number;
        simulatedSampleCount: number;
        sourcePeriodCount: number;
        scorecard: import("@prisma/client/runtime/client").JsonValue;
        proxyStates: import("@prisma/client/runtime/client").JsonValue;
        leaderSummary: import("@prisma/client/runtime/client").JsonValue;
        markdown: string | null;
    }>;
    rebuildRegimes(): Promise<{
        proxies: number;
        leaderRuns: number;
        outcomes: number;
        periods: number;
    }>;
}
