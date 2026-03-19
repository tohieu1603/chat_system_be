import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseService } from '../common/services/base.service';
import { TeamInvitation } from '../entities/team-invitation.entity';
import { TeamMember } from '../entities/team-member.entity';
import { InvitationStatus, TeamRole } from '../common/enums';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { RespondInvitationDto } from './dto/respond-invitation.dto';

@Injectable()
export class TeamInvitationsService extends BaseService<TeamInvitation> {
  protected readonly logger = new Logger(TeamInvitationsService.name);

  constructor(
    @InjectRepository(TeamInvitation)
    private readonly invitationRepository: Repository<TeamInvitation>,
    @InjectRepository(TeamMember)
    private readonly teamMemberRepository: Repository<TeamMember>,
  ) {
    super(invitationRepository);
  }

  /** POST /teams/:teamId/invitations — leader invites by email */
  async createInvitation(
    teamId: string,
    inviterId: string,
    dto: CreateInvitationDto,
  ): Promise<TeamInvitation> {
    // Verify caller is leader
    const leaderMembership = await this.teamMemberRepository.findOne({
      where: { team_id: teamId, user_id: inviterId, role: TeamRole.LEADER },
    });

    if (!leaderMembership) {
      throw new ForbiddenException('Only the team leader can send invitations');
    }

    // Check team is not full
    const memberCount = await this.teamMemberRepository.count({ where: { team_id: teamId } });
    const team = await this.invitationRepository.manager
      .createQueryBuilder()
      .select('t.id', 'id')
      .addSelect('t.max_members', 'max_members')
      .from('teams', 't')
      .where('t.id = :teamId', { teamId })
      .getRawOne<{ id: string; max_members: number }>();

    if (!team) {
      throw new BadRequestException('Team not found');
    }

    if (memberCount >= team.max_members) {
      throw new BadRequestException('Team is full (max 3 members)');
    }

    // Check no existing pending invitation for same email
    const existing = await this.invitationRepository.findOne({
      where: {
        team_id: teamId,
        invited_email: dto.invited_email,
        status: InvitationStatus.PENDING,
      },
    });

    if (existing) {
      throw new BadRequestException('A pending invitation already exists for this email');
    }

    const invitation = await this.create({
      team_id: teamId,
      invited_by: inviterId,
      invited_email: dto.invited_email,
      status: InvitationStatus.PENDING,
    });

    this.logger.log(`Invitation sent to ${dto.invited_email} for team ${teamId}`);
    return invitation;
  }

  /** GET /invitations/pending — current user's pending invitations */
  async getPendingInvitations(userEmail: string): Promise<TeamInvitation[]> {
    return this.invitationRepository.find({
      where: { invited_email: userEmail, status: InvitationStatus.PENDING },
      relations: ['team', 'inviter'],
      order: { created_at: 'DESC' },
    });
  }

  /** PATCH /invitations/:id — accept or decline */
  async respondToInvitation(
    id: string,
    userEmail: string,
    userId: string,
    dto: RespondInvitationDto,
  ): Promise<TeamInvitation> {
    const invitation = await this.findByIdOrFail(id, ['team', 'team.members']);

    if (invitation.invited_email !== userEmail) {
      throw new ForbiddenException('You can only respond to your own invitations');
    }

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException('Invitation has already been responded to');
    }

    if (dto.status === InvitationStatus.ACCEPTED) {
      // Check team not full
      const memberCount = await this.teamMemberRepository.count({
        where: { team_id: invitation.team_id },
      });

      if (memberCount >= invitation.team.max_members) {
        throw new BadRequestException('Team is full — cannot accept invitation');
      }

      // Check user not already in a team in this batch
      const alreadyInTeam = await this.teamMemberRepository
        .createQueryBuilder('tm')
        .innerJoin('tm.team', 'team', 'team.batch_id = :batchId', { batchId: invitation.team.batch_id })
        .where('tm.user_id = :userId', { userId })
        .getOne();

      if (alreadyInTeam) {
        throw new BadRequestException('You are already in a team for this batch');
      }

      // Auto-create TeamMember
      const member = this.teamMemberRepository.create({
        team_id: invitation.team_id,
        user_id: userId,
        role: TeamRole.MEMBER,
      });
      await this.teamMemberRepository.save(member);

      this.logger.log(`User ${userId} accepted invitation ${id} and joined team ${invitation.team_id}`);
    }

    invitation.status = dto.status;
    return this.invitationRepository.save(invitation);
  }

  /** DELETE /invitations/:id — inviter cancels invitation */
  async cancelInvitation(id: string, inviterId: string): Promise<void> {
    const invitation = await this.findByIdOrFail(id);

    if (invitation.invited_by !== inviterId) {
      throw new ForbiddenException('Only the inviter can cancel this invitation');
    }

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException('Only pending invitations can be cancelled');
    }

    await this.invitationRepository.remove(invitation);
    this.logger.log(`Invitation ${id} cancelled by user ${inviterId}`);
  }
}
