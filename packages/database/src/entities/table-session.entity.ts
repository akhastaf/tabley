import { Column, Entity, Index } from 'typeorm';
import { TenantScopedEntity } from './_base';

export type TableSessionStatus =
  | 'active'
  | 'closed_by_owner'
  | 'closed_by_staff'
  | 'expired';

@Entity({ name: 'table_sessions' })
export class TableSessionEntity extends TenantScopedEntity {
  @Index()
  @Column({ name: 'table_id', type: 'uuid' })
  tableId!: string;

  @Index()
  @Column({ type: 'varchar', length: 24, default: 'active' })
  status!: TableSessionStatus;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'last_activity_at', type: 'timestamptz' })
  lastActivityAt!: Date;

  @Column({ name: 'closed_at', type: 'timestamptz', nullable: true })
  closedAt!: Date | null;

  @Column({ name: 'closed_by_user_id', type: 'varchar', length: 64, nullable: true })
  closedByUserId!: string | null;
}
