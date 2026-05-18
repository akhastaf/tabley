import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'node:crypto';
import { TenantEntity } from '@tabley/database';

@Injectable()
export class TenantSettingsService {
  constructor(
    @InjectRepository(TenantEntity) private readonly tenants: Repository<TenantEntity>,
  ) {}

  async get(tenantId: string) {
    const t = await this.tenants.findOne({ where: { id: tenantId } });
    if (!t) throw new NotFoundException({ code: 'TENANT_NOT_FOUND', message: 'Not found' });
    return {
      id: t.id,
      slug: t.slug,
      name: t.name,
      deliveryEnabled: t.deliveryEnabled,
      defaultLocale: t.defaultLocale,
      posWebhookEnabled: t.posWebhookEnabled,
      posWebhookUrl: t.posWebhookUrl,
      // Don't return the secret in plaintext — return whether one is set.
      posWebhookSecretSet: !!t.posWebhookSecret,
    };
  }

  async patch(
    tenantId: string,
    input: {
      deliveryEnabled?: boolean;
      defaultLocale?: string;
      posWebhookEnabled?: boolean;
      posWebhookUrl?: string | null;
      regenerateWebhookSecret?: boolean;
    },
  ) {
    const t = await this.tenants.findOne({ where: { id: tenantId } });
    if (!t) throw new NotFoundException({ code: 'TENANT_NOT_FOUND', message: 'Not found' });

    if (input.deliveryEnabled !== undefined) t.deliveryEnabled = input.deliveryEnabled;
    if (input.defaultLocale !== undefined) t.defaultLocale = input.defaultLocale;
    if (input.posWebhookEnabled !== undefined) t.posWebhookEnabled = input.posWebhookEnabled;
    if (input.posWebhookUrl !== undefined) {
      t.posWebhookUrl = input.posWebhookUrl?.trim() || null;
    }
    let newSecret: string | null = null;
    if (input.regenerateWebhookSecret) {
      newSecret = randomBytes(32).toString('hex');
      t.posWebhookSecret = newSecret;
    }

    await this.tenants.save(t);

    return {
      ...(await this.get(tenantId)),
      // Show the new secret exactly once when regenerated; otherwise omit.
      ...(newSecret ? { posWebhookSecret: newSecret } : {}),
    };
  }
}
