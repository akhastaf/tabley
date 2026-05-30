import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'node:crypto';
import { OpeningHours, TenantEntity } from '@tabley/database';
import { isOpenNow } from './opening-hours';

function parseNumeric(v: string | null): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

@Injectable()
export class TenantSettingsService {
  constructor(
    @InjectRepository(TenantEntity) private readonly tenants: Repository<TenantEntity>,
  ) {}

  async get(tenantId: string) {
    const t = await this.tenants.findOne({ where: { id: tenantId } });
    if (!t) throw new NotFoundException({ code: 'TENANT_NOT_FOUND', message: 'Not found' });
    return this.serialize(t);
  }

  async patch(
    tenantId: string,
    input: {
      deliveryEnabled?: boolean;
      defaultLocale?: string;
      logoUrl?: string | null;
      posWebhookEnabled?: boolean;
      posWebhookUrl?: string | null;
      regenerateWebhookSecret?: boolean;
      regeneratePosApiKey?: boolean;
      revokePosApiKey?: boolean;
      // Restaurant info
      addressLine?: string | null;
      city?: string | null;
      postalCode?: string | null;
      country?: string | null;
      phone?: string | null;
      email?: string | null;
      websiteUrl?: string | null;
      latitude?: number | null;
      longitude?: number | null;
      timezone?: string | null;
      openingHours?: OpeningHours | null;
    },
  ) {
    const t = await this.tenants.findOne({ where: { id: tenantId } });
    if (!t) throw new NotFoundException({ code: 'TENANT_NOT_FOUND', message: 'Not found' });

    if (input.deliveryEnabled !== undefined) t.deliveryEnabled = input.deliveryEnabled;
    if (input.defaultLocale !== undefined) t.defaultLocale = input.defaultLocale;
    if (input.logoUrl !== undefined) t.logoUrl = input.logoUrl?.trim() || null;
    if (input.posWebhookEnabled !== undefined) t.posWebhookEnabled = input.posWebhookEnabled;
    if (input.posWebhookUrl !== undefined) {
      t.posWebhookUrl = input.posWebhookUrl?.trim() || null;
    }

    // Restaurant info — `null` clears, an empty/whitespace string also clears.
    if (input.addressLine !== undefined) t.addressLine = input.addressLine?.trim() || null;
    if (input.city !== undefined) t.city = input.city?.trim() || null;
    if (input.postalCode !== undefined) t.postalCode = input.postalCode?.trim() || null;
    if (input.country !== undefined) t.country = input.country?.trim() || null;
    if (input.phone !== undefined) t.phone = input.phone?.trim() || null;
    if (input.email !== undefined) t.email = input.email?.trim() || null;
    if (input.websiteUrl !== undefined) t.websiteUrl = input.websiteUrl?.trim() || null;
    if (input.latitude !== undefined) {
      t.latitude = input.latitude === null ? null : String(input.latitude);
    }
    if (input.longitude !== undefined) {
      t.longitude = input.longitude === null ? null : String(input.longitude);
    }
    if (input.timezone !== undefined) t.timezone = input.timezone?.trim() || null;
    if (input.openingHours !== undefined) t.openingHours = input.openingHours;

    let newSecret: string | null = null;
    if (input.regenerateWebhookSecret) {
      newSecret = randomBytes(32).toString('hex');
      t.posWebhookSecret = newSecret;
    }
    let newApiKey: string | null = null;
    if (input.revokePosApiKey) {
      t.posApiKey = null;
    } else if (input.regeneratePosApiKey) {
      newApiKey = `tbl_${randomBytes(24).toString('hex')}`;
      t.posApiKey = newApiKey;
    }

    await this.tenants.save(t);

    return {
      ...(await this.get(tenantId)),
      // Show the new credentials exactly once when regenerated; otherwise omit.
      ...(newSecret ? { posWebhookSecret: newSecret } : {}),
      ...(newApiKey ? { posApiKey: newApiKey } : {}),
    };
  }

  /**
   * Serializer shared by GET and PATCH — keeps the network payload consistent
   * and converts numeric(9,6) columns (parsed as strings by node-postgres) to
   * numbers so the client can plug them straight into the map.
   */
  private serialize(t: TenantEntity) {
    const openStatus = isOpenNow({
      openingHours: t.openingHours,
      timezone: t.timezone,
    });
    return {
      id: t.id,
      slug: t.slug,
      name: t.name,
      logoUrl: t.logoUrl,
      deliveryEnabled: t.deliveryEnabled,
      defaultLocale: t.defaultLocale,
      posWebhookEnabled: t.posWebhookEnabled,
      posWebhookUrl: t.posWebhookUrl,
      // Don't return the secret in plaintext — return whether one is set.
      posWebhookSecretSet: !!t.posWebhookSecret,
      posApiKeySet: !!t.posApiKey,
      addressLine: t.addressLine,
      city: t.city,
      postalCode: t.postalCode,
      country: t.country,
      phone: t.phone,
      email: t.email,
      websiteUrl: t.websiteUrl,
      latitude: parseNumeric(t.latitude),
      longitude: parseNumeric(t.longitude),
      timezone: t.timezone,
      openingHours: t.openingHours,
      openNow: openStatus.open,
      openReason: openStatus.reason ?? null,
    };
  }
}
