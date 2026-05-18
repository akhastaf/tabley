import { Column, Entity, Index } from 'typeorm';
import { TenantScopedEntity } from './_base';

@Entity({ name: 'payments' })
export class PaymentEntity extends TenantScopedEntity {
  @Index()
  @Column({ name: 'order_id', type: 'uuid' })
  orderId!: string;

  @Column({ type: 'varchar', length: 16 })
  method!: string;

  @Column({ type: 'varchar', length: 16 })
  status!: string;

  @Column({ name: 'amount_cents', type: 'integer' })
  amountCents!: number;

  @Column({ name: 'provider_ref', type: 'varchar', length: 128, nullable: true })
  providerRef!: string | null;

  @Column({ name: 'captured_at', type: 'timestamptz', nullable: true })
  capturedAt!: Date | null;
}
