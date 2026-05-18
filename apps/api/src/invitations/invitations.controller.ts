import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { UserRole } from '@tabley/shared';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { TenantGuard, TenantRoles } from '../tenant/tenant.guard';
import { CurrentTenant, TenantCtx } from '../tenant/current-tenant.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { InvitationsService } from './invitations.service';

const inviteSchema = z.object({
  email: z.string().email().max(254),
  role: z.enum([UserRole.MANAGER, UserRole.WAITER, UserRole.KITCHEN, UserRole.CASHIER]),
});

@Controller('manage/team')
@UseGuards(AuthGuard, TenantGuard)
@TenantRoles(UserRole.MANAGER, UserRole.PLATFORM_ADMIN)
export class InvitationsController {
  constructor(private readonly service: InvitationsService) {}

  @Get()
  list(@CurrentTenant() t: TenantCtx) {
    return this.service.list(t.id);
  }

  @Post('invite')
  invite(
    @CurrentTenant() t: TenantCtx,
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(inviteSchema)) body: z.infer<typeof inviteSchema>,
  ) {
    return this.service.create(t.id, t.slug, user.id, body);
  }

  @Delete('invite/:id')
  revoke(@CurrentTenant() t: TenantCtx, @Param('id') id: string) {
    return this.service.revoke(t.id, id);
  }
}
