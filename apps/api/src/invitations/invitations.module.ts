import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantEntity, TenantInvitationEntity, TenantMemberEntity } from '@tabley/database';
import { EmailModule } from '../email/email.module';
import { InvitationsController } from './invitations.controller';
import { PublicInvitationsController } from './public-invitations.controller';
import { InvitationsService } from './invitations.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([TenantInvitationEntity, TenantMemberEntity, TenantEntity]),
    EmailModule,
  ],
  controllers: [InvitationsController, PublicInvitationsController],
  providers: [InvitationsService],
})
export class InvitationsModule {}
