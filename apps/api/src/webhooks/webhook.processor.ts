import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { createHmac } from 'node:crypto';
import { POS_WEBHOOK_QUEUE } from './constants';
import type { PosWebhookPayload } from './webhook.service';

interface JobData {
  url: string;
  secret: string;
  payload: PosWebhookPayload;
}

@Processor(POS_WEBHOOK_QUEUE)
export class WebhookProcessor extends WorkerHost {
  private readonly logger = new Logger(WebhookProcessor.name);

  async process(job: Job<JobData>): Promise<void> {
    const { url, secret, payload } = job.data;
    const body = JSON.stringify(payload);
    const signature = secret
      ? createHmac('sha256', secret).update(body).digest('hex')
      : '';

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Tabley-Webhook/1.0',
          'X-Tabley-Event': payload.event,
          'X-Tabley-Tenant': payload.tenantSlug,
          'X-Tabley-Delivery': job.id ?? '',
          ...(signature ? { 'X-Tabley-Signature': `sha256=${signature}` } : {}),
        },
        body,
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`pos webhook ${url} returned ${res.status}: ${text.slice(0, 200)}`);
      }
      this.logger.log(
        `delivered ${payload.event} for order ${payload.orderId.slice(0, 8)} to ${url} (${res.status})`,
      );
    } catch (err) {
      clearTimeout(timer);
      this.logger.warn(
        `pos webhook ${payload.event} attempt ${job.attemptsMade + 1}/${job.opts.attempts ?? 1} failed: ${(err as Error).message}`,
      );
      throw err;
    }
  }
}
