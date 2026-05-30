import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from './_base';

// A menu language the restaurant offers. `code` is a short identifier used as
// the translation key (e.g. 'it', 'darija'); `name` is the display label.
export interface TenantMenuLanguage {
  code: string;
  name: string;
}

// Weekly opening hours. Times are `HH:MM` 24h strings interpreted in the
// tenant's IANA timezone (`TenantEntity.timezone`). `closed: true` means the
// day is fully closed; `open`/`close` are ignored in that case. A single
// range per day is enough for most restaurants; multi-range (lunch + dinner)
// can be layered on later without breaking the shape.
export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export interface DayHours {
  closed: boolean;
  open: string;
  close: string;
}
export type OpeningHours = Record<DayKey, DayHours>;

@Entity({ name: 'tenants' })
export class TenantEntity extends BaseEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 80 })
  slug!: string;

  @Column({ type: 'varchar', length: 160 })
  name!: string;

  @Column({ name: 'plan', type: 'varchar', length: 32, default: 'free' })
  plan!: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'delivery_enabled', type: 'boolean', default: false })
  deliveryEnabled!: boolean;

  @Column({ name: 'default_locale', type: 'varchar', length: 8, default: 'en' })
  defaultLocale!: string;

  // Public URL of the restaurant's logo (stored in object storage). Used for
  // QR-code branding and the public menu header.
  @Column({ name: 'logo_url', type: 'varchar', length: 2048, nullable: true })
  logoUrl!: string | null;

  @Column({ name: 'menu_languages', type: 'jsonb', default: () => "'[]'::jsonb" })
  menuLanguages!: TenantMenuLanguage[];

  @Column({ name: 'pos_webhook_url', type: 'varchar', length: 2048, nullable: true })
  posWebhookUrl!: string | null;

  @Column({ name: 'pos_webhook_secret', type: 'varchar', length: 128, nullable: true })
  posWebhookSecret!: string | null;

  @Column({ name: 'pos_webhook_enabled', type: 'boolean', default: false })
  posWebhookEnabled!: boolean;

  @Index()
  @Column({ name: 'pos_api_key', type: 'varchar', length: 128, nullable: true })
  posApiKey!: string | null;

  // ─── Public restaurant info ─────────────────────────────────────────────
  // Shown on the public menu page, used for the "open now" gate and the map
  // preview. All nullable so existing tenants keep working unchanged.

  @Column({ name: 'address_line', type: 'varchar', length: 255, nullable: true })
  addressLine!: string | null;

  @Column({ name: 'city', type: 'varchar', length: 120, nullable: true })
  city!: string | null;

  @Column({ name: 'postal_code', type: 'varchar', length: 20, nullable: true })
  postalCode!: string | null;

  @Column({ name: 'country', type: 'varchar', length: 80, nullable: true })
  country!: string | null;

  @Column({ name: 'phone', type: 'varchar', length: 40, nullable: true })
  phone!: string | null;

  @Column({ name: 'email', type: 'varchar', length: 255, nullable: true })
  email!: string | null;

  @Column({ name: 'website_url', type: 'varchar', length: 2048, nullable: true })
  websiteUrl!: string | null;

  // numeric(9,6) parses as string out of pg by default; the entity layer keeps
  // it as a string and the service converts to number when serializing.
  @Column({ name: 'latitude', type: 'numeric', precision: 9, scale: 6, nullable: true })
  latitude!: string | null;

  @Column({ name: 'longitude', type: 'numeric', precision: 9, scale: 6, nullable: true })
  longitude!: string | null;

  // IANA timezone id (e.g. 'Europe/Paris'). Required to evaluate openingHours
  // correctly across DST. When null, the open-now check falls back to UTC.
  @Column({ name: 'timezone', type: 'varchar', length: 64, nullable: true })
  timezone!: string | null;

  @Column({ name: 'opening_hours', type: 'jsonb', nullable: true })
  openingHours!: OpeningHours | null;
}
