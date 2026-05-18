import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { InvitationsService } from './invitations.service';

@Controller('invitations')
export class PublicInvitationsController {
  constructor(private readonly service: InvitationsService) {}

  @Get(':token')
  async lookup(@Param('token') token: string) {
    const { invitation, tenant, valid } = await this.service.lookup(token);
    return {
      valid,
      status: invitation.status,
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
      tenant: tenant ? { slug: tenant.slug, name: tenant.name } : null,
    };
  }

  @Post(':token/accept')
  @UseGuards(AuthGuard)
  accept(
    @Param('token') token: string,
    @CurrentUser() user: { id: string; email: string },
  ) {
    return this.service.accept(token, user.id, user.email);
  }
}
