import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TeamInvitation } from '../entities/team-invitation.entity';
import { TeamMember } from '../entities/team-member.entity';
import { TeamInvitationsService } from './team-invitations.service';
import { TeamInvitationsController } from './team-invitations.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [TypeOrmModule.forFeature([TeamInvitation, TeamMember]), NotificationsModule],
  providers: [TeamInvitationsService],
  controllers: [TeamInvitationsController],
  exports: [TeamInvitationsService],
})
export class TeamInvitationsModule {}
