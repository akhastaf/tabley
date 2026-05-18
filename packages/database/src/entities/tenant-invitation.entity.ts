import { Column, Entity, Index } from 'typeorm';
import { TenantScopedEntity } from './_base';

@Entity({ name: 'tenant_invitations' })
export class TenantInvitationEntity extends TenantScopedEntity {
  @Index()
  @Column({ type: 'varchar', length: 254 })
  email!: string;

  @Column({ type: 'varchar', length: 32 })
  role!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64 })
  token!: string;

  @Index()
  @Column({ type: 'varchar', length: 16 })
  status!: 'pending' | 'accepted' | 'revoked' | 'expired';

  @Column({ name: 'invited_by_user_id', type: 'varchar', length: 64 })
  invitedByUserId!: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'accepted_at', type: 'timestamptz', nullable: true })
  acceptedAt!: Date | null;

  @Column({ name: 'accepted_by_user_id', type: 'varchar', length: 64, nullable: true })
  acceptedByUserId!: string | null;
}
