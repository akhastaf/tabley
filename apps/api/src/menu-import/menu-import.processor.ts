import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { extractMenuFromImage } from './ai-extractor';
import { MenuImportService } from './menu-import.service';
import { OrdersGateway } from '../realtime/orders.gateway';
import { MENU_IMPORT_QUEUE } from './constants';

interface JobData {
  tenantId: string;
  importId: string;
  imageBase64: string;
  mimeType: string;
}

@Processor(MENU_IMPORT_QUEUE)
export class MenuImportProcessor extends WorkerHost {
  private readonly logger = new Logger(MenuImportProcessor.name);

  constructor(
    private readonly service: MenuImportService,
    private readonly gateway: OrdersGateway,
  ) {
    super();
  }

  async process(job: Job<JobData>): Promise<void> {
    const { tenantId, importId, imageBase64, mimeType } = job.data;
    this.logger.log(`extracting menu for import=${importId}`);
    await this.service.markProcessing(importId);
    this.gateway.emitOrderEvent(tenantId, 'menu.import.processing', { importId });

    try {
      const { result, modelUsed } = await extractMenuFromImage({ imageBase64, mimeType });
      await this.service.markCompleted(importId, result, modelUsed);
      this.gateway.emitOrderEvent(tenantId, 'menu.import.completed', {
        importId,
        categories: result.categories.length,
        items: result.categories.reduce((n, c) => n + c.items.length, 0),
      });
      this.logger.log(`extraction done import=${importId} model=${modelUsed}`);
    } catch (err) {
      const message = (err as Error).message;
      this.logger.error(`extraction failed import=${importId}: ${message}`);
      await this.service.markFailed(importId, message);
      this.gateway.emitOrderEvent(tenantId, 'menu.import.failed', { importId, error: message });
    }
  }
}
