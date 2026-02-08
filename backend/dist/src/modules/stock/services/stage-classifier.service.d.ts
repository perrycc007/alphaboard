import { StageEnum, StockCategory } from '@prisma/client';
export interface StageClassification {
    stage: StageEnum;
    category: StockCategory;
    isTemplate: boolean;
    criteria: Record<string, boolean>;
}
export declare function classifyStage(currentPrice: number, sma50: number, sma150: number, sma200: number, sma200_30dAgo: number, high52w: number, low52w: number): StageClassification;
export declare class StageClassifierService {
    classify(currentPrice: number, sma50: number, sma150: number, sma200: number, sma200_30dAgo: number, high52w: number, low52w: number): StageClassification;
}
