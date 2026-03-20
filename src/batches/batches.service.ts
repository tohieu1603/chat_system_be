import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseService } from '../common/services/base.service';
import { Batch } from '../entities/batch.entity';
import { BatchStatus } from '../common/enums';
import { CreateBatchDto } from './dto/create-batch.dto';
import { UpdateBatchDto } from './dto/update-batch.dto';
import { PaginationDto } from '../common/dto/pagination.dto';

/** Valid status transitions: UPCOMING → OPEN → CLOSED */
const STATUS_TRANSITIONS: Record<BatchStatus, BatchStatus[]> = {
  [BatchStatus.UPCOMING]: [BatchStatus.OPEN],
  [BatchStatus.OPEN]: [BatchStatus.CLOSED],
  [BatchStatus.CLOSED]: [],
};

export interface BatchStats {
  team_count: number;
  candidate_count: number;
  plan_count: number;
}

@Injectable()
export class BatchesService extends BaseService<Batch> {
  protected readonly logger = new Logger(BatchesService.name);

  constructor(
    @InjectRepository(Batch)
    private readonly batchRepository: Repository<Batch>,
  ) {
    super(batchRepository);
  }

  async listBatches(
    query: PaginationDto,
  ): Promise<{ data: Batch[]; total: number; page: number; limit: number }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const qb = this.batchRepository
      .createQueryBuilder('batch')
      .orderBy('batch.created_at', 'DESC')
      .skip(skip)
      .take(limit);

    if (query.search) {
      qb.where('batch.name ILIKE :search', { search: `%${query.search}%` });
    }

    const [data, total] = await qb.getManyAndCount();
    this.logger.log(`listBatches: ${total} total`);
    return { data, total, page, limit };
  }

  async createBatch(dto: CreateBatchDto): Promise<Batch> {
    // If creating with OPEN status, ensure no other OPEN batch exists
    if (dto.status === BatchStatus.OPEN) {
      await this.assertNoOpenBatch();
    }

    const batch = await this.create({
      name: dto.name,
      description: dto.description,
      status: dto.status ?? BatchStatus.UPCOMING,
      max_teams: dto.max_teams ?? 10,
      application_start: dto.application_start ? new Date(dto.application_start) : undefined,
      application_end: dto.application_end ? new Date(dto.application_end) : undefined,
    });

    this.logger.log(`Batch created: id=${batch.id}`);
    return batch;
  }

  async updateBatch(id: string, dto: UpdateBatchDto): Promise<Batch> {
    const batch = await this.findByIdOrFail(id);

    // Validate status transition if status is being changed
    if (dto.status && dto.status !== batch.status) {
      const allowed = STATUS_TRANSITIONS[batch.status] ?? [];
      if (!allowed.includes(dto.status)) {
        throw new BadRequestException(
          `Cannot transition batch status from ${batch.status} to ${dto.status}`,
        );
      }

      // If transitioning to OPEN, ensure uniqueness
      if (dto.status === BatchStatus.OPEN) {
        await this.assertNoOpenBatch(id);
      }
    }

    const updated = await this.update(id, {
      name: dto.name ?? batch.name,
      description: dto.description ?? batch.description,
      status: dto.status ?? batch.status,
      max_teams: dto.max_teams ?? batch.max_teams,
      application_start: dto.application_start ? new Date(dto.application_start) : batch.application_start,
      application_end: dto.application_end ? new Date(dto.application_end) : batch.application_end,
    });

    this.logger.log(`Batch updated: id=${id}`);
    return updated;
  }

  async removeBatch(id: string): Promise<void> {
    await this.remove(id);
    this.logger.log(`Batch removed: id=${id}`);
  }

  async getBatchStats(id: string): Promise<BatchStats> {
    await this.findByIdOrFail(id);

    const [teamCount, candidateCount, planCount] = await Promise.all([
      this.batchRepository.manager
        .createQueryBuilder()
        .select('COUNT(*)', 'count')
        .from('teams', 't')
        .where('t.batch_id = :id', { id })
        .getRawOne<{ count: string }>()
        .then((r) => parseInt(r?.count ?? '0', 10)),

      this.batchRepository.manager
        .createQueryBuilder()
        .select('COUNT(DISTINCT tm.user_id)', 'count')
        .from('teams', 't')
        .innerJoin('team_members', 'tm', 'tm.team_id = t.id')
        .where('t.batch_id = :id', { id })
        .getRawOne<{ count: string }>()
        .then((r) => parseInt(r?.count ?? '0', 10)),

      this.batchRepository.manager
        .createQueryBuilder()
        .select('COUNT(*)', 'count')
        .from('plans', 'p')
        .innerJoin('teams', 't', 't.id = p.team_id')
        .where('t.batch_id = :id', { id })
        .getRawOne<{ count: string }>()
        .then((r) => parseInt(r?.count ?? '0', 10)),
    ]);

    return {
      team_count: teamCount,
      candidate_count: candidateCount,
      plan_count: planCount,
    };
  }

  /** Get the currently OPEN batch */
  async getOpenBatch(): Promise<Batch | null> {
    return this.batchRepository.findOne({ where: { status: BatchStatus.OPEN } });
  }

  private async assertNoOpenBatch(excludeId?: string): Promise<void> {
    const qb = this.batchRepository
      .createQueryBuilder('batch')
      .where('batch.status = :status', { status: BatchStatus.OPEN });

    if (excludeId) {
      qb.andWhere('batch.id != :excludeId', { excludeId });
    }

    const existing = await qb.getOne();
    if (existing) {
      throw new BadRequestException(
        `Batch "${existing.name}" is already OPEN. Only one OPEN batch is allowed at a time.`,
      );
    }
  }

  /** Get all candidate user_ids in a batch */
  async getCandidatesByBatch(batchId: string): Promise<{ user_id: string }[]> {
    return this.repository.manager.query(
      `SELECT DISTINCT tm.user_id FROM team_members tm JOIN teams t ON t.id = tm.team_id WHERE t.batch_id = $1`,
      [batchId],
    );
  }
}
