import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { randomBytes } from 'node:crypto';
import {
  RestaurantTableEntity,
  TenantEntity,
  TenantInvitationEntity,
  TenantMemberEntity,
} from '@tabley/database';
import { UserRole } from '@tabley/shared';
import { EmailService } from '../email/email.service';

const INVITABLE_ROLES = new Set<string>([
  UserRole.MANAGER,
  UserRole.WAITER,
  UserRole.KITCHEN,
  UserRole.CASHIER,
]);

const EXPIRY_HOURS = 72;

function newToken() {
  return randomBytes(24).toString('hex'); // 48 chars
}

@Injectable()
export class InvitationsService {
  constructor(
    @InjectRepository(TenantInvitationEntity)
    private readonly invitations: Repository<TenantInvitationEntity>,
    @InjectRepository(TenantMemberEntity)
    private readonly members: Repository<TenantMemberEntity>,
    @InjectRepository(TenantEntity)
    private readonly tenants: Repository<TenantEntity>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly email: EmailService,
  ) {}

  async list(tenantId: string) {
    const [pending, mems] = await Promise.all([
      this.invitations.find({
        where: { tenantId, status: 'pending' },
        order: { createdAt: 'DESC' },
      }),
      this.members.find({ where: { tenantId }, order: { createdAt: 'ASC' } }),
    ]);
    // Enrich members with their user info from the Better Auth user table.
    const userIds = [...new Set(mems.map((m) => m.userId))];
    const users = userIds.length
      ? await this.dataSource.query<
          Array<{ id: string; name: string; email: string; avatarUrl: string | null }>
        >(
          'SELECT id, name, email, "avatarUrl" FROM "user" WHERE id = ANY($1::text[])',
          [userIds],
        )
      : [];
    const usersById = new Map(users.map((u) => [u.id, u]));
    const enrichedMembers = mems.map((m) => {
      const u = usersById.get(m.userId);
      return {
        id: m.id,
        userId: m.userId,
        role: m.role,
        invitedEmail: m.invitedEmail,
        createdAt: m.createdAt,
        name: u?.name ?? null,
        email: u?.email ?? null,
        avatarUrl: u?.avatarUrl ?? null,
      };
    });
    return { pending, members: enrichedMembers };
  }

  async create(
    tenantId: string,
    tenantSlug: string,
    invitedByUserId: string,
    input: { email: string; role: string },
  ) {
    const email = input.email.trim().toLowerCase();
    const role = input.role;
    if (!INVITABLE_ROLES.has(role)) {
      throw new BadRequestException({ code: 'INVALID_ROLE', message: 'Role not invitable' });
    }

    const existingInvite = await this.invitations.findOne({
      where: { tenantId, email, status: 'pending' },
    });
    if (existingInvite) {
      throw new ConflictException({
        code: 'INVITE_EXISTS',
        message: 'There is already a pending invite for that email',
      });
    }

    const token = newToken();
    const expiresAt = new Date(Date.now() + EXPIRY_HOURS * 3600 * 1000);
    const row = await this.invitations.save(
      this.invitations.create({
        tenantId,
        email,
        role,
        token,
        status: 'pending',
        invitedByUserId,
        expiresAt,
      }),
    );

    const tenant = await this.tenants.findOne({ where: { id: tenantId } });
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3010';
    const inviteUrl = `${appUrl}/invite/${token}`;
    const tenantName = tenant?.name ?? tenantSlug;

    await this.email.send({
      to: email,
      subject: `You've been invited to ${tenantName} on Tabley`,
      html: renderInviteHtml({ tenantName, role, inviteUrl }),
      text: `You've been invited to ${tenantName} on Tabley as a ${role}. Accept here: ${inviteUrl}`,
    });

    return row;
  }

  async updateMemberRole(tenantId: string, memberId: string, role: string) {
    if (!INVITABLE_ROLES.has(role)) {
      throw new BadRequestException({ code: 'INVALID_ROLE', message: 'Role not assignable' });
    }
    const member = await this.members.findOne({ where: { id: memberId, tenantId } });
    if (!member) {
      throw new NotFoundException({ code: 'MEMBER_NOT_FOUND', message: 'Member not found' });
    }
    if (member.role === role) return member;
    // A tenant must always keep at least one manager, so block demoting the last.
    if (member.role === UserRole.MANAGER && role !== UserRole.MANAGER) {
      await this.assertNotLastManager(tenantId);
    }
    member.role = role;
    return this.members.save(member);
  }

  async removeMember(tenantId: string, memberId: string) {
    const member = await this.members.findOne({ where: { id: memberId, tenantId } });
    if (!member) {
      throw new NotFoundException({ code: 'MEMBER_NOT_FOUND', message: 'Member not found' });
    }
    if (member.role === UserRole.MANAGER) {
      await this.assertNotLastManager(tenantId);
    }
    await this.dataSource.transaction(async (m) => {
      // Release any tables in this person's zone so they don't point at a
      // non-member (which would leave those tables stranded between waiters).
      await m
        .getRepository(RestaurantTableEntity)
        .update({ tenantId, assignedWaiterId: member.userId }, { assignedWaiterId: null });
      await m.getRepository(TenantMemberEntity).delete({ id: memberId, tenantId });
    });
    return { ok: true };
  }

  private async assertNotLastManager(tenantId: string) {
    const managers = await this.members.count({
      where: { tenantId, role: UserRole.MANAGER },
    });
    if (managers <= 1) {
      throw new ConflictException({
        code: 'LAST_MANAGER',
        message: 'This is the only manager — promote someone else first',
      });
    }
  }

  async revoke(tenantId: string, id: string) {
    const inv = await this.invitations.findOne({ where: { id, tenantId } });
    if (!inv) throw new NotFoundException({ code: 'INVITE_NOT_FOUND', message: 'Not found' });
    if (inv.status !== 'pending') {
      throw new ConflictException({
        code: 'INVALID_STATE',
        message: `Invite is ${inv.status} and cannot be revoked`,
      });
    }
    inv.status = 'revoked';
    return this.invitations.save(inv);
  }

  async lookup(token: string) {
    const inv = await this.invitations.findOne({ where: { token } });
    if (!inv) throw new NotFoundException({ code: 'INVITE_NOT_FOUND', message: 'Not found' });
    if (inv.status !== 'pending') {
      return { invitation: inv, tenant: null as TenantEntity | null, valid: false as const };
    }
    if (inv.expiresAt.getTime() < Date.now()) {
      inv.status = 'expired';
      await this.invitations.save(inv);
      return { invitation: inv, tenant: null, valid: false as const };
    }
    const tenant = await this.tenants.findOne({ where: { id: inv.tenantId } });
    return { invitation: inv, tenant, valid: true as const };
  }

  async accept(token: string, userId: string, userEmail: string) {
    const inv = await this.invitations.findOne({ where: { token } });
    if (!inv) throw new NotFoundException({ code: 'INVITE_NOT_FOUND', message: 'Not found' });
    if (inv.status !== 'pending') {
      throw new ConflictException({
        code: 'INVALID_STATE',
        message: `Invite is ${inv.status}`,
      });
    }
    if (inv.expiresAt.getTime() < Date.now()) {
      inv.status = 'expired';
      await this.invitations.save(inv);
      throw new ConflictException({ code: 'EXPIRED', message: 'Invite has expired' });
    }
    if (userEmail.toLowerCase() !== inv.email) {
      throw new UnauthorizedException({
        code: 'EMAIL_MISMATCH',
        message: 'Sign in with the email the invite was sent to',
      });
    }

    return this.dataSource.transaction(async (m) => {
      const memberRepo = m.getRepository(TenantMemberEntity);
      const inviteRepo = m.getRepository(TenantInvitationEntity);
      const existing = await memberRepo.findOne({
        where: { tenantId: inv.tenantId, userId },
      });
      if (!existing) {
        await memberRepo.save(
          memberRepo.create({
            tenantId: inv.tenantId,
            userId,
            role: inv.role,
            invitedEmail: inv.email,
          }),
        );
      } else if (existing.role !== inv.role) {
        existing.role = inv.role;
        await memberRepo.save(existing);
      }
      inv.status = 'accepted';
      inv.acceptedAt = new Date();
      inv.acceptedByUserId = userId;
      await inviteRepo.save(inv);

      const tenant = await m.getRepository(TenantEntity).findOne({ where: { id: inv.tenantId } });
      return { tenantSlug: tenant?.slug ?? '', role: inv.role };
    });
  }
}

function renderInviteHtml(args: { tenantName: string; role: string; inviteUrl: string }) {
  return `
  <div style="font-family: -apple-system,Segoe UI,sans-serif;max-width:480px;margin:0 auto;padding:24px;">
    <h1 style="font-size:20px;margin-bottom:8px;">You've been invited</h1>
    <p style="color:#555;line-height:1.5;">
      ${escapeHtml(args.tenantName)} invited you to join Tabley as <strong>${escapeHtml(args.role)}</strong>.
    </p>
    <p style="margin:24px 0;">
      <a href="${args.inviteUrl}"
         style="display:inline-block;background:#111;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:500;">
        Accept invitation
      </a>
    </p>
    <p style="color:#888;font-size:12px;">
      Or paste this link into your browser:<br>${args.inviteUrl}
    </p>
    <p style="color:#bbb;font-size:11px;margin-top:32px;">
      This invitation expires in 72 hours.
    </p>
  </div>`;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"]/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&quot;',
  );
}
