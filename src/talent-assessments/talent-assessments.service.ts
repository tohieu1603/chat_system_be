import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseService } from '../common/services/base.service';
import { TalentAssessment } from '../entities/talent-assessment.entity';
import { CreateAssessmentDto } from './dto/create-assessment.dto';
import { UpdateAssessmentDto } from './dto/update-assessment.dto';
import { QueryAssessmentsDto } from './dto/query-assessments.dto';

@Injectable()
export class TalentAssessmentsService extends BaseService<TalentAssessment> {
  protected readonly logger = new Logger(TalentAssessmentsService.name);

  constructor(
    @InjectRepository(TalentAssessment)
    private readonly assessmentRepo: Repository<TalentAssessment>,
  ) {
    super(assessmentRepo);
  }

  /** Create assessment — 1 per user per batch */
  async createAssessment(evaluatorId: string, dto: CreateAssessmentDto): Promise<TalentAssessment> {
    const existing = await this.assessmentRepo.findOne({
      where: { user_id: dto.user_id, batch_id: dto.batch_id },
    });
    if (existing) {
      throw new BadRequestException('An assessment already exists for this user in this batch');
    }

    return this.create({
      user_id: dto.user_id,
      evaluator_id: evaluatorId,
      batch_id: dto.batch_id,
      business_thinking: dto.business_thinking,
      marketing_ability: dto.marketing_ability,
      proactiveness: dto.proactiveness,
      teamwork: dto.teamwork,
      learning_speed: dto.learning_speed,
      resilience: dto.resilience,
      comments: dto.comments,
      potential_role: dto.potential_role,
      training_notes: dto.training_notes,
    });
  }

  /** Get assessment by ID */
  async getAssessmentById(id: string): Promise<TalentAssessment> {
    return this.findByIdOrFail(id, ['user', 'evaluator', 'batch']);
  }

  /** Update assessment */
  async updateAssessment(id: string, dto: UpdateAssessmentDto): Promise<TalentAssessment> {
    await this.findByIdOrFail(id);

    const updates: Partial<TalentAssessment> = {};
    for (const [key, value] of Object.entries(dto)) {
      if (value !== undefined) {
        (updates as any)[key] = value;
      }
    }

    return this.update(id, updates);
  }

  /** Get all assessments for a user */
  async getAssessmentsByUser(userId: string): Promise<TalentAssessment[]> {
    const assessments = await this.assessmentRepo.find({
      where: { user_id: userId },
      relations: ['evaluator', 'batch'],
      order: { created_at: 'DESC' } as any,
    });

    if (!assessments.length) {
      throw new NotFoundException(`No assessments found for user "${userId}"`);
    }

    return assessments;
  }

  /** Admin: list all assessments with optional batch filter */
  async findAll(query: QueryAssessmentsDto): Promise<{ data: TalentAssessment[]; total: number; page: number; limit: number }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const qb = this.assessmentRepo
      .createQueryBuilder('assessment')
      .leftJoinAndSelect('assessment.user', 'user')
      .leftJoinAndSelect('assessment.evaluator', 'evaluator')
      .leftJoinAndSelect('assessment.batch', 'batch')
      .skip(skip)
      .take(limit)
      .orderBy('assessment.created_at', 'DESC');

    if (query.batch_id) {
      qb.andWhere('assessment.batch_id = :batchId', { batchId: query.batch_id });
    }

    const [data, total] = await qb.getManyAndCount();
    this.logger.log(`findAll: total=${total} assessments`);
    return { data, total, page, limit };
  }
}
