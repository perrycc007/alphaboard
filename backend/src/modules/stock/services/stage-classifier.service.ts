import { Injectable } from '@nestjs/common';
import { StageEnum, StockCategory } from '@prisma/client';

/**
 * Stage 2 Template (Minervini):
 * 1. Price > 150MA and Price > 200MA
 * 2. 150MA > 200MA
 * 3. 200MA trending up >= 1 month
 * 4. 50MA > 150MA and 50MA > 200MA
 * 5. Price > 50MA
 * 6. Price >= 30% above 52w low
 * 7. Price within 25% of 52w high
 */
export interface StageClassification {
  stage: StageEnum;
  category: StockCategory;
  isTemplate: boolean;
  criteria: Record<string, boolean>;
}

/** Pure domain logic -- no DB dependency */
export function classifyStage(
  currentPrice: number,
  sma50: number,
  sma150: number,
  sma200: number,
  sma200_30dAgo: number,
  high52w: number,
  low52w: number,
): StageClassification {
  const criteria: Record<string, boolean> = {
    priceAbove150and200: currentPrice > sma150 && currentPrice > sma200,
    ma150Above200: sma150 > sma200,
    ma200TrendingUp: sma200 > sma200_30dAgo,
    ma50Above150and200: sma50 > sma150 && sma50 > sma200,
    priceAbove50: currentPrice > sma50,
    above30PctFrom52wLow: currentPrice >= low52w * 1.3,
    within25PctOf52wHigh: currentPrice >= high52w * 0.75,
  };

  const allCriteriaMet = Object.values(criteria).every(Boolean);

  // Determine stage
  let stage: StageEnum;
  if (allCriteriaMet) {
    stage = StageEnum.STAGE_2;
  } else if (currentPrice > sma200 && sma200 > sma200_30dAgo) {
    stage = StageEnum.STAGE_1; // accumulation
  } else if (currentPrice < sma200 && sma200 < sma200_30dAgo) {
    stage = StageEnum.STAGE_4; // decline
  } else {
    stage = StageEnum.STAGE_3; // distribution
  }

  const category =
    stage === StageEnum.STAGE_2
      ? StockCategory.HOT
      : criteria.priceAbove150and200 && criteria.ma50Above150and200
        ? StockCategory.FORMER_HOT
        : StockCategory.NONE;

  return {
    stage,
    category,
    isTemplate: allCriteriaMet,
    criteria,
  };
}

@Injectable()
export class StageClassifierService {
  classify(
    currentPrice: number,
    sma50: number,
    sma150: number,
    sma200: number,
    sma200_30dAgo: number,
    high52w: number,
    low52w: number,
  ): StageClassification {
    return classifyStage(
      currentPrice,
      sma50,
      sma150,
      sma200,
      sma200_30dAgo,
      high52w,
      low52w,
    );
  }
}
