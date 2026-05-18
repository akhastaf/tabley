import { Column, Entity, Index } from 'typeorm';
import { TenantScopedEntity } from './_base';

@Entity({ name: 'order_lines' })
export class OrderLineEntity extends TenantScopedEntity {
  @Index()
  @Column({ name: 'order_id', type: 'uuid' })
  orderId!: string;

  @Column({ name: 'menu_item_id', type: 'uuid' })
  menuItemId!: string;

  @Column({ name: 'item_name_snapshot', type: 'varchar', length: 120 })
  itemNameSnapshot!: string;

  @Column({ name: 'unit_price_cents', type: 'integer' })
  unitPriceCents!: number;

  @Column({ type: 'integer' })
  quantity!: number;

  @Column({ type: 'text', nullable: true })
  note!: string | null;
}
