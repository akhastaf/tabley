import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Queue } from 'bullmq';
import { TenantEntity } from '@tabley/database';
import { POS_WEBHOOK_QUEUE } from './constants';

export interface PosWebhookPayload {
  tenantId: string;
  tenantSlug: string;
  event: string;
  orderId: string;
  status: string;
  channel?: string;
  totalCents?: number;
  occurredAt: string;
}

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    @InjectRepository(TenantEntity) private readonly tenants: Repository<TenantEntity>,
    @InjectQueue(POS_WEBHOOK_QUEUE) private readonly queue: Queue,
  ) {}

  /**
   * Enqueue a POS webhook for an order event. Best-effort: if the tenant
   * doesn't have a webhook configured (or it's disabled), the call is a
   * no-op. Caller doesn't need to await.
   */
  async enqueueOrderEvent(args: {
    tenantId: string;
    event: string;
    orderId: string;
    status: string;
    channel?: string;
    totalCents?: number;
  }) {
    const tenant = await this.tenants.findOne({ where: { id: args.tenantId } });
    if (!tenant || !tenant.posWebhookEnabled || !tenant.posWebhookUrl) return;

    const payload: PosWebhookPayload = {
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      event: args.event,
      orderId: args.orderId,
      status: args.status,
      channel: args.channel,
      totalCents: args.totalCents,
      occurredAt: new Date().toISOString(),
    };

    try {
      await this.queue.add('deliver', {
        url: tenant.posWebhookUrl,
        secret: tenant.posWebhookSecret ?? '',
        payload,
      }, {
        attempts: 5,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 200,
        removeOnFail: 200,
      });
    } catch (err) {
      this.logger.warn(`failed to enqueue webhook for ${args.orderId}: ${(err as Error).message}`);
    }
  }
}
