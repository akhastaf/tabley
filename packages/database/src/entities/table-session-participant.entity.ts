import { Column, Entity, Index, Unique } from 'typeorm';
import { BaseEntity } from './_base';

export type TableSessionRole = 'owner' | 'member' | 'pending';

@Entity({ name: 'table_session_participants' })
@Unique('uq_session_device', ['sessionId', 'deviceId'])
export class TableSessionParticipantEntity extends BaseEntity {
  @Index()
  @Column({ name: 'session_id', type: 'uuid' })
  sessionId!: string;

  @Column({ name: 'user_id', type: 'varchar', length: 64, nullable: true })
  userId!: string | null;

  @Column({ name: 'device_id', type: 'varchar', length: 64 })
  deviceId!: string;

  @Column({ name: 'display_name', type: 'varchar', length: 80 })
  displayName!: string;

  @Column({ type: 'varchar', length: 16 })
  role!: TableSessionRole;

  @Column({ name: 'joined_at', type: 'timestamptz' })
  joinedAt!: Date;

  @Column({ name: 'left_at', type: 'timestamptz', nullable: true })
  leftAt!: Date | null;
}
