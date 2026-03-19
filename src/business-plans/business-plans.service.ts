import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseService } from '../common/services/base.service';
import { BusinessPlan } from '../entities/business-plan.entity';
import { TeamMember } from '../entities/team-member.entity';
import { Team } from '../entities/team.entity';
import { Batch } from '../entities/batch.entity';
import { PlanStatus, BatchStatus, TeamRole } from '../common/enums';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { UpdatePlanStatusDto } from './dto/update-plan-status.dto';
import { QueryPlansDto } from './dto/query-plans.dto';

const REQUIRED_SECTIONS: (keyof BusinessPlan)[] = [
  'executive_summary',
  'problem_statement',
  'solution',
  'target_market',
  'customer_persona',
  'competitive_analysis',
  'organic_marketing',
  'operation_workflow',
  'payment_system',
  'tech_requirements',
  'cost_structure',
  'revenue_model',
  'milestones',
];

@Injectable()
export class BusinessPlansService extends BaseService<BusinessPlan> {
  protected readonly logger = new Logger(BusinessPlansService.name);

  constructor(
    @InjectRepository(BusinessPlan)
    private readonly planRepo: Repository<BusinessPlan>,
    @InjectRepository(TeamMember)
    private readonly teamMemberRepo: Repository<TeamMember>,
    @InjectRepository(Team)
    private readonly teamRepo: Repository<Team>,
    @InjectRepository(Batch)
    private readonly batchRepo: Repository<Batch>,
  ) {
    super(planRepo);
  }

  /** Create a plan — user must be in a team in the specified open batch */
  async createPlan(userId: string, dto: CreatePlanDto): Promise<BusinessPlan> {
    // Find team membership in the batch
    const membership = await this.teamMemberRepo
      .createQueryBuilder('tm')
      .innerJoin('tm.team', 'team', 'team.batch_id = :batchId', { batchId: dto.batch_id })
      .where('tm.user_id = :userId', { userId })
      .getOne();

    if (!membership) {
      throw new BadRequestException('You do not belong to a team in this batch');
    }

    const batch = await this.batchRepo.findOne({ where: { id: dto.batch_id } });
    if (!batch || batch.status !== BatchStatus.OPEN) {
      throw new BadRequestException('Batch is not open for submissions');
    }

    // 1 plan per team per batch
    const existing = await this.planRepo.findOne({
      where: { team_id: membership.team_id, batch_id: dto.batch_id },
    });
    if (existing) {
      throw new BadRequestException('Team already has a business plan for this batch');
    }

    return this.create({
      team_id: membership.team_id,
      batch_id: dto.batch_id,
      title: dto.title,
      status: PlanStatus.DRAFT,
      executive_summary: dto.executive_summary,
      problem_statement: dto.problem_statement,
      solution: dto.solution,
      target_market: dto.target_market,
      customer_persona: dto.customer_persona,
      competitive_analysis: dto.competitive_analysis,
      organic_marketing: dto.organic_marketing,
      paid_advertising: dto.paid_advertising,
      operation_workflow: dto.operation_workflow,
      payment_system: dto.payment_system,
      tech_requirements: dto.tech_requirements,
      cost_structure: dto.cost_structure,
      revenue_model: dto.revenue_model,
      milestones: dto.milestones,
      attachments: dto.attachments,
    });
  }

  /** Get current user's team plan (any open batch — most recent) */
  async getMyPlan(userId: string): Promise<BusinessPlan> {
    const membership = await this.teamMemberRepo.findOne({ where: { user_id: userId } });
    if (!membership) {
      throw new NotFoundException('You are not in any team');
    }

    const plan = await this.planRepo.findOne({
      where: { team_id: membership.team_id },
      relations: ['team', 'batch'],
      order: { created_at: 'DESC' } as any,
    });

    if (!plan) {
      throw new NotFoundException('No business plan found for your team');
    }

    return plan;
  }

  /** Get plan by ID — accessible to team members or admin */
  async getPlanForUser(planId: string, userId: string, isAdmin: boolean): Promise<BusinessPlan> {
    const plan = await this.findByIdOrFail(planId, ['team', 'batch', 'team.members']);

    if (isAdmin) return plan;

    const isMember = plan.team?.members?.some((m) => m.user_id === userId);
    if (!isMember) {
      throw new ForbiddenException('You do not have access to this plan');
    }

    return plan;
  }

  /** Auto-save partial PATCH — only DRAFT allowed, team members only */
  async autoSave(planId: string, userId: string, dto: UpdatePlanDto): Promise<BusinessPlan> {
    const plan = await this.findByIdOrFail(planId, ['team', 'team.members']);

    const isMember = plan.team?.members?.some((m) => m.user_id === userId);
    if (!isMember) {
      throw new ForbiddenException('You do not have access to this plan');
    }

    if (plan.status !== PlanStatus.DRAFT) {
      throw new BadRequestException('Plan can only be edited in DRAFT status');
    }

    // Only apply provided (non-undefined) fields
    const updates: Partial<BusinessPlan> = {};
    for (const [key, value] of Object.entries(dto)) {
      if (value !== undefined) {
        (updates as any)[key] = value;
      }
    }

    return this.update(planId, updates);
  }

  /** Submit plan — team leader only, draft → submitted, validates required sections */
  async submitPlan(planId: string, userId: string): Promise<BusinessPlan> {
    const plan = await this.findByIdOrFail(planId, ['team', 'team.members']);

    if (plan.status !== PlanStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT plans can be submitted');
    }

    const membership = plan.team?.members?.find((m) => m.user_id === userId);
    if (!membership) {
      throw new ForbiddenException('You do not have access to this plan');
    }
    if (membership.role !== TeamRole.LEADER) {
      throw new ForbiddenException('Only team leader can submit the plan');
    }

    // Validate required sections
    const missing = REQUIRED_SECTIONS.filter((field) => {
      const val = (plan as any)[field];
      return val === null || val === undefined || val === '' || (Array.isArray(val) && val.length === 0);
    });

    if (missing.length > 0) {
      throw new BadRequestException(`Missing required sections: ${missing.join(', ')}`);
    }

    return this.update(planId, {
      status: PlanStatus.SUBMITTED,
      submitted_at: new Date(),
    });
  }

  /** Admin list all plans with filters */
  async findAll(query: QueryPlansDto): Promise<{ data: BusinessPlan[]; total: number; page: number; limit: number }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const qb = this.planRepo
      .createQueryBuilder('plan')
      .leftJoinAndSelect('plan.team', 'team')
      .leftJoinAndSelect('plan.batch', 'batch')
      .skip(skip)
      .take(limit)
      .orderBy('plan.created_at', 'DESC');

    if (query.status) {
      qb.andWhere('plan.status = :status', { status: query.status });
    }
    if (query.batch_id) {
      qb.andWhere('plan.batch_id = :batchId', { batchId: query.batch_id });
    }

    const [data, total] = await qb.getManyAndCount();
    this.logger.log(`findAll: total=${total} plans`);
    return { data, total, page, limit };
  }

  /** Admin updates plan status (transition validation) */
  async updateStatus(planId: string, dto: UpdatePlanStatusDto): Promise<BusinessPlan> {
    const plan = await this.findByIdOrFail(planId);

    const ALLOWED_TRANSITIONS: Record<PlanStatus, PlanStatus[]> = {
      [PlanStatus.DRAFT]: [PlanStatus.SUBMITTED],
      [PlanStatus.SUBMITTED]: [PlanStatus.REVIEWING, PlanStatus.APPROVED, PlanStatus.REJECTED],
      [PlanStatus.REVIEWING]: [PlanStatus.APPROVED, PlanStatus.REJECTED, PlanStatus.DRAFT],
      [PlanStatus.APPROVED]: [],
      [PlanStatus.REJECTED]: [PlanStatus.DRAFT],
    };

    const allowed = ALLOWED_TRANSITIONS[plan.status] ?? [];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(`Cannot transition from ${plan.status} to ${dto.status}`);
    }

    const updates: Partial<BusinessPlan> = { status: dto.status };

    this.logger.log(`Plan ${planId}: status ${plan.status} → ${dto.status}`);
    return this.update(planId, updates);
  }
}
