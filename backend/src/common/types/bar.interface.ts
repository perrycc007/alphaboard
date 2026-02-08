export interface Bar {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  date?: Date;
  timestamp?: Date;
}

export interface BarWithIndicators extends Bar {
  sma20?: number;
  sma50?: number;
  sma150?: number;
  sma200?: number;
  ema6?: number;
  ema20?: number;
  atr14?: number;
  rsRank?: number;
}
