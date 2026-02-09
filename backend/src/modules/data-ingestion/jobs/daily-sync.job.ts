import { Injectable, Logger, forwardRef, Inject } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PipelineService } from '../services/pipeline.service';

/**
 * Daily sync job: cron fallback that delegates to the full pipeline.
 * Primary sync happens on startup via PipelineService.onModuleInit.
 * This cron fires at 5 PM EST Mon-Fri as a safety net.
 */
@Injectable()
export class DailySyncJob {
  private readonly logger = new Logger(DailySyncJob.name);

  constructor(
    @Inject(forwardRef(() => PipelineService))
    private readonly pipelineService: PipelineService,
  ) {}

  @Cron('0 17 * * 1-5')
  async run(): Promise<void> {
    if (this.pipelineService.isRunning()) {
      this.logger.log('Pipeline already running, skipping daily sync cron');
      return;
    }

    this.logger.log('Daily sync cron triggered, delegating to pipeline...');
    try {
      await this.pipelineService.checkAndSync();
    } catch (err) {
      this.logger.error('Daily sync pipeline failed', err);
    }
  }
}
