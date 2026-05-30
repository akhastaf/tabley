import { Column, Entity, Index, Unique } from 'typeorm';
import { TenantScopedEntity } from './_base';

@Entity({ name: 'restaurant_tables' })
@Unique('uq_table_label', ['tenantId', 'label'])
export class RestaurantTableEntity extends TenantScopedEntity {
  @Column({ type: 'varchar', length: 40 })
  label!: string;

  @Index({ unique: true })
  @Column({ name: 'token_hash', type: 'varchar', length: 128 })
  tokenHash!: string;

  @Column({ type: 'integer', default: 4 })
  capacity!: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  // The waiter (Better Auth user id) responsible for this table's zone. Null
  // means unassigned — covered by any waiter who has no zone of their own.
  @Index()
  @Column({ name: 'assigned_waiter_id', type: 'varchar', length: 64, nullable: true })
  assignedWaiterId!: string | null;
}
