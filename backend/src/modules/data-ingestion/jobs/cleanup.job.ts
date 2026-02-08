import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../../prisma/prisma.service';

/**
 * Cleanup job: runs at end of day.
 * - Purges all StockIntraday rows older than today (spec: only current day intraday)
 */
@Injectable()
export class CleanupJob {
  private readonly logger = new Logger(CleanupJob.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron('0 20 * * 1-5') // 8:00 PM EST
  async run(): Promise<void> {
    this.logger.log('Starting cleanup...');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const result = await this.prisma.stockIntraday.deleteMany({
      where: { timestamp: { lt: today } },
    });

    this.logger.log(`Cleaned up ${result.count} stale intraday records`);
  }
}
