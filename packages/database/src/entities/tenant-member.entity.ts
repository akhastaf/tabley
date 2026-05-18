import { Column, Entity, Index, Unique } from 'typeorm';
import { TenantScopedEntity } from './_base';

@Entity({ name: 'tenant_members' })
@Unique('uq_tenant_member', ['tenantId', 'userId'])
export class TenantMemberEntity extends TenantScopedEntity {
  @Index()
  @Column({ name: 'user_id', type: 'varchar', length: 64 })
  userId!: string;

  @Column({ type: 'varchar', length: 32 })
  role!: string;

  @Column({ name: 'invited_email', type: 'varchar', length: 254, nullable: true })
  invitedEmail!: string | null;
}
