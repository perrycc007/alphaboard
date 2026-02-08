import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../../prisma/prisma.service';

/**
 * Breadth sync job: fetches market breadth indicators after daily close.
 * Sources: NAAD, NAA50R, NAA200R, NAHL.
 */
@Injectable()
export class BreadthSyncJob {
  private readonly logger = new Logger(BreadthSyncJob.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron('15 17 * * 1-5') // 5:15 PM, after daily sync
  async run(): Promise<void> {
    this.logger.log('Starting breadth sync...');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // TODO: Integrate with breadth data source
    // For now, create a placeholder if not exists
    await this.prisma.breadthSnapshot.upsert({
      where: { date: today },
      create: { date: today },
      update: {},
    });

    this.logger.log('Breadth sync complete');
  }
}
