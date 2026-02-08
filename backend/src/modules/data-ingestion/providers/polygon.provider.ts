import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  IntradayDataProvider,
  IntradayBarData,
} from './market-data.provider';

/**
 * Polygon.io provider for intraday + real-time data.
 * Supports REST for historical intraday and WebSocket for live streaming.
 */
@Injectable()
export class PolygonProvider implements IntradayDataProvider {
  private readonly logger = new Logger(PolygonProvider.name);
  private readonly apiKey: string;
  private readonly restUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('polygon.apiKey', '');
    this.restUrl = this.configService.get<string>(
      'polygon.restUrl',
      'https://api.polygon.io',
    );
  }

  async fetchIntradayBars(
    ticker: string,
    date: Date,
  ): Promise<IntradayBarData[]> {
    this.logger.log(
      `Fetching intraday bars for ${ticker} on ${date.toISOString().slice(0, 10)}`,
    );

    if (!this.apiKey) {
      this.logger.warn('Polygon API key not configured');
      return [];
    }

    // TODO: Implement real Polygon.io REST call
    // const dateStr = date.toISOString().slice(0, 10);
    // const url = `${this.restUrl}/v2/aggs/ticker/${ticker}/range/5/minute/${dateStr}/${dateStr}?apiKey=${this.apiKey}`;
    // const response = await fetch(url);
    // const data = await response.json();
    // return data.results.map(r => ({ ... }));

    return [];
  }
}
