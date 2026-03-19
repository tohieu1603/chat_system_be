import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseService } from '../common/services/base.service';
import { TeamMember } from '../entities/team-member.entity';
import { TeamRole } from '../common/enums';

@Injectable()
export class TeamMembersService extends BaseService<TeamMember> {
  protected readonly logger = new Logger(TeamMembersService.name);

  constructor(
    @InjectRepository(TeamMember)
    private readonly teamMemberRepository: Repository<TeamMember>,
  ) {
    super(teamMemberRepository);
  }

  /** GET /teams/:teamId/members */
  async listMembers(teamId: string): Promise<TeamMember[]> {
    return this.teamMemberRepository.find({
      where: { team_id: teamId },
      relations: ['user'],
      order: { joined_at: 'ASC' },
    });
  }

  /** DELETE /teams/:teamId/members/:userId — leader removes a member */
  async removeMember(teamId: string, leaderId: string, targetUserId: string): Promise<void> {
    // Verify caller is leader
    const leaderMembership = await this.teamMemberRepository.findOne({
      where: { team_id: teamId, user_id: leaderId, role: TeamRole.LEADER },
    });

    if (!leaderMembership) {
      throw new ForbiddenException('Only the team leader can remove members');
    }

    // Leader cannot remove themselves
    if (leaderId === targetUserId) {
      throw new BadRequestException('Leader cannot remove themselves from the team');
    }

    const membership = await this.teamMemberRepository.findOne({
      where: { team_id: teamId, user_id: targetUserId },
    });

    if (!membership) {
      throw new BadRequestException('User is not a member of this team');
    }

    await this.teamMemberRepository.remove(membership);
    this.logger.log(`User ${targetUserId} removed from team ${teamId} by leader ${leaderId}`);
  }
}
