import { Column, Entity, Index } from 'typeorm';
import { TenantScopedEntity } from './_base';

@Entity({ name: 'orders' })
export class OrderEntity extends TenantScopedEntity {
  @Index()
  @Column({ name: 'table_id', type: 'uuid', nullable: true })
  tableId!: string | null;

  @Index()
  @Column({ name: 'customer_user_id', type: 'varchar', length: 64, nullable: true })
  customerUserId!: string | null;

  @Column({ name: 'guest_session_id', type: 'varchar', length: 64, nullable: true })
  guestSessionId!: string | null;

  @Index()
  @Column({ type: 'varchar', length: 32 })
  status!: string;

  @Column({ type: 'varchar', length: 16 })
  channel!: string;

  @Column({ name: 'total_cents', type: 'integer', default: 0 })
  totalCents!: number;

  @Column({ name: 'customer_note', type: 'text', nullable: true })
  customerNote!: string | null;

  @Column({ name: 'confirmed_by_user_id', type: 'varchar', length: 64, nullable: true })
  confirmedByUserId!: string | null;

  @Column({ name: 'confirmed_at', type: 'timestamptz', nullable: true })
  confirmedAt!: Date | null;

  @Column({ name: 'delivery_address', type: 'jsonb', nullable: true })
  deliveryAddress!: DeliveryAddress | null;

  @Column({ name: 'delivery_phone', type: 'varchar', length: 40, nullable: true })
  deliveryPhone!: string | null;

  @Column({ name: 'delivery_notes', type: 'text', nullable: true })
  deliveryNotes!: string | null;
}

export interface DeliveryAddress {
  recipientName: string;
  line1: string;
  line2?: string;
  city: string;
  postalCode: string;
  country?: string;
}
