import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseService } from '../common/services/base.service';
import { FinanceRecord } from '../entities/finance-record.entity';
import { PaginationDto } from '../common/dto/pagination.dto';
import { CreateFinanceDto } from './dto/create-finance.dto';
import { UpdateFinanceDto } from './dto/update-finance.dto';

export interface FinanceSummary {
  total_revenue: number;
  by_status: Record<string, number>;
  by_month: Array<{ month: string; total: number }>;
}

@Injectable()
export class FinanceService extends BaseService<FinanceRecord> {
  protected readonly logger = new Logger(FinanceService.name);

  constructor(
    @InjectRepository(FinanceRecord)
    private readonly financeRepo: Repository<FinanceRecord>,
  ) {
    super(financeRepo);
  }

  async findByProject(
    projectId: string,
    query: PaginationDto,
  ): Promise<{ data: FinanceRecord[]; total: number; page: number; limit: number }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const [data, total] = await this.financeRepo.findAndCount({
      where: { project_id: projectId },
      relations: ['creator'],
      skip,
      take: limit,
      order: { created_at: 'DESC' } as any,
    });

    this.logger.log(`findByProject: projectId=${projectId}, total=${total}`);
    return { data, total, page, limit };
  }

  async createRecord(
    projectId: string,
    userId: string,
    dto: CreateFinanceDto,
  ): Promise<FinanceRecord> {
    const record = this.financeRepo.create({
      ...dto,
      project_id: projectId,
      created_by: userId,
    } as unknown as FinanceRecord);
    const saved = await this.financeRepo.save(record) as FinanceRecord;
    this.logger.log(`createRecord: projectId=${projectId}, recordId=${saved.id}`);
    return saved;
  }

  async updateRecord(id: string, dto: UpdateFinanceDto): Promise<FinanceRecord> {
    return this.update(id, dto as any);
  }

  /** List all finance records with pagination */
  async findAll(query: PaginationDto): Promise<{ data: FinanceRecord[]; total: number; page: number; limit: number }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;

    const [data, total] = await this.financeRepo.findAndCount({
      relations: ['project'],
      skip,
      take: limit,
      order: { created_at: 'DESC' } as any,
    });

    this.logger.log(`findAll: total=${total}`);
    return { data, total, page, limit };
  }

  async getSummary(): Promise<FinanceSummary> {
    const byStatus = await this.financeRepo
      .createQueryBuilder('f')
      .select('f.status', 'status')
      .addSelect('SUM(f.amount)', 'total')
      .groupBy('f.status')
      .getRawMany<{ status: string; total: string }>();

    const byMonth = await this.financeRepo
      .createQueryBuilder('f')
      .select("TO_CHAR(f.created_at, 'YYYY-MM')", 'month')
      .addSelect('SUM(f.amount)', 'total')
      .where("f.status = 'PAID'")
      .groupBy("TO_CHAR(f.created_at, 'YYYY-MM')")
      .orderBy("TO_CHAR(f.created_at, 'YYYY-MM')", 'ASC')
      .getRawMany<{ month: string; total: string }>();

    const total_revenue = byMonth.reduce((sum, row) => sum + parseFloat(row.total ?? '0'), 0);

    const by_status = byStatus.reduce<Record<string, number>>((acc, row) => {
      acc[row.status] = parseFloat(row.total ?? '0');
      return acc;
    }, {});

    this.logger.log(`getSummary: total_revenue=${total_revenue}`);
    return {
      total_revenue,
      by_status,
      by_month: byMonth.map((r) => ({ month: r.month, total: parseFloat(r.total ?? '0') })),
    };
  }
}
