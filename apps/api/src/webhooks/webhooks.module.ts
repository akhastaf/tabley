import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantEntity } from '@tabley/database';
import { POS_WEBHOOK_QUEUE } from './constants';
import { WebhookProcessor } from './webhook.processor';
import { WebhookService } from './webhook.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([TenantEntity]),
    BullModule.registerQueue({ name: POS_WEBHOOK_QUEUE }),
  ],
  providers: [WebhookService, WebhookProcessor],
  exports: [WebhookService],
})
export class WebhooksModule {}
