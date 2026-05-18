import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from './_base';

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
}
