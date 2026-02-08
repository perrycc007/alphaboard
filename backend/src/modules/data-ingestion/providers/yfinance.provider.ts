import { Injectable, Logger } from '@nestjs/common';
import { MarketDataProvider, DailyBarData } from './market-data.provider';

/**
 * yfinance provider for historical daily data.
 * In production, this would call a Python microservice or yfinance REST wrapper.
 * For now, provides the interface and a stub implementation.
 */
@Injectable()
export class YFinanceProvider implements MarketDataProvider {
  private readonly logger = new Logger(YFinanceProvider.name);

  async fetchDailyBars(
    ticker: string,
    from: Date,
    to: Date,
  ): Promise<DailyBarData[]> {
    this.logger.log(
      `Fetching daily bars for ${ticker} from ${from.toISOString()} to ${to.toISOString()}`,
    );

    // TODO: Integrate with yfinance Python microservice or REST API
    // For now, return empty array. In production:
    // const response = await fetch(`http://yfinance-service/daily?ticker=${ticker}&from=${from}&to=${to}`);
    // return response.json();

    return [];
  }
}
