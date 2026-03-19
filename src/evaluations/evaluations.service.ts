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
import { Evaluation } from '../entities/evaluation.entity';
import { BusinessPlan } from '../entities/business-plan.entity';
import { TeamMember } from '../entities/team-member.entity';
import { EvaluationRecommendation, PlanStatus } from '../common/enums';
import { CreateEvaluationDto } from './dto/create-evaluation.dto';
import { UpdateEvaluationDto } from './dto/update-evaluation.dto';

@Injectable()
export class EvaluationsService extends BaseService<Evaluation> {
  protected readonly logger = new Logger(EvaluationsService.name);

  constructor(
    @InjectRepository(Evaluation)
    private readonly evalRepo: Repository<Evaluation>,
    @InjectRepository(BusinessPlan)
    private readonly planRepo: Repository<BusinessPlan>,
    @InjectRepository(TeamMember)
    private readonly teamMemberRepo: Repository<TeamMember>,
  ) {
    super(evalRepo);
  }

  /** Compute weighted total from scores */
  private computeWeightedTotal(
    workflow?: number,
    business?: number,
    organic?: number,
    ads?: number,
  ): number | null {
    if (workflow == null || business == null || organic == null || ads == null) {
      return null;
    }
    const total = workflow * 0.35 + business * 0.30 + organic * 0.25 + ads * 0.10;
    return parseFloat(total.toFixed(2));
  }

  /** Create evaluation — admin only, 1 per plan */
  async createEvaluation(evaluatorId: string, dto: CreateEvaluationDto): Promise<Evaluation> {
    const plan = await this.planRepo.findOne({ where: { id: dto.plan_id } });
    if (!plan) {
      throw new NotFoundException(`BusinessPlan with id "${dto.plan_id}" not found`);
    }

    const existing = await this.evalRepo.findOne({ where: { plan_id: dto.plan_id } });
    if (existing) {
      throw new BadRequestException('An evaluation already exists for this plan');
    }

    const weighted_total = this.computeWeightedTotal(
      dto.workflow_score,
      dto.business_score,
      dto.organic_score,
      dto.ads_score,
    );

    const evaluation = await this.create({
      plan_id: dto.plan_id,
      evaluator_id: evaluatorId,
      workflow_score: dto.workflow_score,
      business_score: dto.business_score,
      organic_score: dto.organic_score,
      ads_score: dto.ads_score,
      weighted_total: weighted_total ?? undefined,
      strengths: dto.strengths,
      weaknesses: dto.weaknesses,
      improvement_notes: dto.improvement_notes,
      recommendation: dto.recommendation,
    });

    // Trigger plan status transitions based on recommendation
    if (dto.recommendation) {
      await this.applyRecommendation(plan, dto.recommendation);
    }

    return evaluation;
  }

  /** Apply recommendation → update plan status accordingly */
  private async applyRecommendation(
    plan: BusinessPlan,
    recommendation: EvaluationRecommendation,
  ): Promise<void> {
    let newStatus: PlanStatus | null = null;

    if (recommendation === EvaluationRecommendation.APPROVE) {
      newStatus = PlanStatus.APPROVED;
    } else if (recommendation === EvaluationRecommendation.REJECT) {
      newStatus = PlanStatus.REJECTED;
    }
    // REVISE → plan stays REVIEWING (no status change needed)

    if (newStatus) {
      await this.planRepo.update(plan.id, { status: newStatus });
      this.logger.log(`Plan ${plan.id}: status → ${newStatus} (recommendation=${recommendation})`);
    }
  }

  /** Get evaluation by ID — admin or team member of associated plan */
  async getEvaluationForUser(evalId: string, userId: string, isAdmin: boolean): Promise<Evaluation> {
    const evaluation = await this.evalRepo.findOne({
      where: { id: evalId },
      relations: ['plan', 'plan.team', 'plan.team.members', 'evaluator'],
    });

    if (!evaluation) {
      throw new NotFoundException(`Evaluation with id "${evalId}" not found`);
    }

    if (isAdmin) return evaluation;

    const isMember = evaluation.plan?.team?.members?.some((m) => m.user_id === userId);
    if (!isMember) {
      throw new ForbiddenException('You do not have access to this evaluation');
    }

    return evaluation;
  }

  /** Update evaluation scores — admin only */
  async updateEvaluation(evalId: string, dto: UpdateEvaluationDto): Promise<Evaluation> {
    const evaluation = await this.findByIdOrFail(evalId, ['plan']);

    const weighted_total = this.computeWeightedTotal(
      dto.workflow_score ?? evaluation.workflow_score,
      dto.business_score ?? evaluation.business_score,
      dto.organic_score ?? evaluation.organic_score,
      dto.ads_score ?? evaluation.ads_score,
    );

    const updates: Partial<Evaluation> = { ...dto };
    if (weighted_total !== null) {
      updates.weighted_total = weighted_total;
    }

    const updated = await this.update(evalId, updates);

    // Re-apply recommendation if it changed or if recommendation exists
    const activeRecommendation = dto.recommendation ?? evaluation.recommendation;
    if (dto.recommendation && evaluation.plan) {
      const plan = await this.planRepo.findOne({ where: { id: evaluation.plan_id } });
      if (plan) {
        await this.applyRecommendation(plan, dto.recommendation);
      }
    } else if (activeRecommendation && evaluation.plan) {
      // recalc in case scores changed but recommendation not changed
    }

    return updated;
  }

  /** Get evaluation for a given plan */
  async getEvaluationByPlan(planId: string): Promise<Evaluation> {
    const evaluation = await this.evalRepo.findOne({
      where: { plan_id: planId },
      relations: ['evaluator'],
    });

    if (!evaluation) {
      throw new NotFoundException(`No evaluation found for plan "${planId}"`);
    }

    return evaluation;
  }
}
