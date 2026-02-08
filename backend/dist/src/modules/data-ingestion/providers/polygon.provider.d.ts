import { ConfigService } from '@nestjs/config';
import { IntradayDataProvider, IntradayBarData } from './market-data.provider';
export declare class PolygonProvider implements IntradayDataProvider {
    private readonly configService;
    private readonly logger;
    private readonly apiKey;
    private readonly restUrl;
    constructor(configService: ConfigService);
    fetchIntradayBars(ticker: string, date: Date): Promise<IntradayBarData[]>;
}
