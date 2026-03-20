import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { BaseService } from '../common/services/base.service';
import { Team } from '../entities/team.entity';
import { TeamMember } from '../entities/team-member.entity';
import { BatchStatus, TeamRole } from '../common/enums';
import { CreateTeamDto } from './dto/create-team.dto';
import { JoinTeamDto } from './dto/join-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../common/enums';

@Injectable()
export class TeamsService extends BaseService<Team> {
  protected readonly logger = new Logger(TeamsService.name);

  constructor(
    @InjectRepository(Team)
    private readonly teamRepository: Repository<Team>,
    @InjectRepository(TeamMember)
    private readonly teamMemberRepository: Repository<TeamMember>,
    private readonly notificationsService: NotificationsService,
  ) {
    super(teamRepository);
  }

  /** GET /teams/my-team — current user's team in the active (OPEN) batch */
  async getMyTeam(userId: string): Promise<Team | null> {
    const team = await this.teamRepository
      .createQueryBuilder('team')
      .innerJoin('team.members', 'tm', 'tm.user_id = :userId', { userId })
      .innerJoin('team.batch', 'batch', 'batch.status = :status', { status: BatchStatus.OPEN })
      .leftJoinAndSelect('team.members', 'member')
      .leftJoinAndSelect('member.user', 'user')
      .leftJoinAndSelect('team.batch', 'b')
      .getOne();

    return team ?? null;
  }

  /** POST /teams — candidate creates a team in the open batch, auto-adds as leader */
  async createTeam(userId: string, dto: CreateTeamDto): Promise<Team> {
    const batchResult = await this.teamRepository.manager
      .createQueryBuilder()
      .select('b.id', 'id')
      .addSelect('b.status', 'status')
      .addSelect('b.max_teams', 'max_teams')
      .from('batches', 'b')
      .where('b.status = :status', { status: BatchStatus.OPEN })
      .getRawOne<{ id: string; status: string; max_teams: number }>();

    if (!batchResult) {
      throw new BadRequestException('No open batch available for team creation');
    }

    // Ensure user is not already in a team in this batch
    await this.assertUserNotInBatch(userId, batchResult.id);

    // Check batch max_teams
    const teamCount = await this.teamRepository.count({ where: { batch_id: batchResult.id } });
    if (teamCount >= batchResult.max_teams) {
      throw new BadRequestException('This batch has reached its maximum number of teams');
    }

    const invite_code = this.generateInviteCode();

    const team = await this.create({
      name: dto.name,
      description: dto.description,
      invite_code,
      batch_id: batchResult.id,
      created_by: userId,
      max_members: 3,
    });

    // Auto-add creator as LEADER
    const member = this.teamMemberRepository.create({
      team_id: team.id,
      user_id: userId,
      role: TeamRole.LEADER,
    });
    await this.teamMemberRepository.save(member);

    this.logger.log(`Team created: id=${team.id} by user=${userId} in batch=${batchResult.id}`);
    return this.findByIdOrFail(team.id, ['members', 'members.user', 'batch']);
  }

  /** POST /teams/join — join team by invite code */
  async joinTeam(userId: string, dto: JoinTeamDto): Promise<Team> {
    const team = await this.teamRepository.findOne({
      where: { invite_code: dto.invite_code },
      relations: ['members', 'batch'],
    });

    if (!team) {
      throw new BadRequestException('Invalid invite code');
    }

    if (team.batch.status !== BatchStatus.OPEN) {
      throw new BadRequestException('The batch for this team is not open');
    }

    // Check user not already in a team in this batch
    await this.assertUserNotInBatch(userId, team.batch_id);

    // Check max members
    const memberCount = await this.teamMemberRepository.count({ where: { team_id: team.id } });
    if (memberCount >= team.max_members) {
      throw new BadRequestException('Team is full (max 3 members)');
    }

    const member = this.teamMemberRepository.create({
      team_id: team.id,
      user_id: userId,
      role: TeamRole.MEMBER,
    });
    await this.teamMemberRepository.save(member);

    this.logger.log(`User ${userId} joined team ${team.id}`);

    // Notify team leader
    try {
      const leader = await this.teamMemberRepository.findOne({ where: { team_id: team.id, role: TeamRole.LEADER } });
      const joiner = await this.teamRepository.manager.query('SELECT full_name FROM users WHERE id = $1', [userId]);
      if (leader && joiner?.[0]) {
        await this.notificationsService.notifyUser(
          leader.user_id,
          'Thành viên mới tham gia',
          `${joiner[0].full_name} đã tham gia đội của bạn`,
          NotificationType.INFO, 'team', team.id,
        );
      }
    } catch (e) { this.logger.warn(`Notification failed: ${e}`); }

    return this.findByIdOrFail(team.id, ['members', 'members.user', 'batch']);
  }

  /** PATCH /teams/:id — update name/desc (leader only) */
  async updateTeam(id: string, userId: string, dto: UpdateTeamDto): Promise<Team> {
    await this.assertIsLeader(id, userId);
    const updated = await this.update(id, dto);
    return updated;
  }

  /** GET /teams/:id — team detail with members */
  async getTeamDetail(id: string): Promise<Team> {
    return this.findByIdOrFail(id, ['members', 'members.user', 'batch']);
  }

  /** Assert user is the team leader */
  async assertIsLeader(teamId: string, userId: string): Promise<void> {
    const membership = await this.teamMemberRepository.findOne({
      where: { team_id: teamId, user_id: userId, role: TeamRole.LEADER },
    });
    if (!membership) {
      throw new ForbiddenException('Only the team leader can perform this action');
    }
  }

  private generateInviteCode(): string {
    return crypto.randomBytes(4).toString('hex');
  }

  private async assertUserNotInBatch(userId: string, batchId: string): Promise<void> {
    const existing = await this.teamMemberRepository
      .createQueryBuilder('tm')
      .innerJoin('tm.team', 'team', 'team.batch_id = :batchId', { batchId })
      .where('tm.user_id = :userId', { userId })
      .getOne();

    if (existing) {
      throw new BadRequestException('You are already in a team for this batch');
    }
  }
}
