import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from '../entities/project.entity';
import { FinanceRecord } from '../entities/finance-record.entity';
import { Batch } from '../entities/batch.entity';
import { User } from '../entities/user.entity';
import { TalentAssessment } from '../entities/talent-assessment.entity';
import { ProjectStatus, Role, FinanceType } from '../common/enums';

@Injectable()
export class OwnerService {
  private readonly logger = new Logger(OwnerService.name);

  constructor(
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @InjectRepository(FinanceRecord)
    private readonly financeRepo: Repository<FinanceRecord>,
    @InjectRepository(Batch)
    private readonly batchRepo: Repository<Batch>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(TalentAssessment)
    private readonly assessmentRepo: Repository<TalentAssessment>,
  ) {}

  async getDashboard() {
    const [totalProjects, activeProjects] = await Promise.all([
      this.projectRepo.count(),
      this.projectRepo.count({ where: { status: ProjectStatus.IN_PROGRESS } }),
    ]);

    const revenueResult = await this.financeRepo
      .createQueryBuilder('fr')
      .select('COALESCE(SUM(fr.amount), 0)', 'total')
      .where('fr.type = :type', { type: FinanceType.PAYMENT })
      .getRawOne<{ total: string }>();
    const totalRevenue = parseFloat(revenueResult?.total ?? '0');

    const [teamCount, candidateCount] = await Promise.all([
      this.userRepo.count({ where: { role: Role.DEV } }),
      this.userRepo.count({ where: { role: Role.CANDIDATE } }),
    ]);

    this.logger.log('Owner dashboard stats fetched');
    return {
      total_projects: totalProjects,
      active_projects: activeProjects,
      total_revenue: totalRevenue,
      team_count: teamCount,
      candidate_count: candidateCount,
    };
  }

  async getProjects(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await this.projectRepo.findAndCount({
      skip,
      take: limit,
      order: { created_at: 'DESC' },
      relations: ['customer'],
    });
    return { data, total, page, limit };
  }

  async getFinanceSummary() {
    const result = await this.financeRepo
      .createQueryBuilder('fr')
      .select('fr.type', 'type')
      .addSelect('COALESCE(SUM(fr.amount), 0)', 'total')
      .groupBy('fr.type')
      .getRawMany<{ type: string; total: string }>();

    const summary: Record<string, number> = {};
    for (const row of result) {
      summary[row.type] = parseFloat(row.total);
    }

    const income = summary[FinanceType.PAYMENT] ?? 0;
    const expense = summary[FinanceType.QUOTE] ?? 0;

    this.logger.log('Owner finance summary fetched');
    return {
      income,
      expense,
      net: income - expense,
      by_type: summary,
    };
  }

  async getBatches(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [batches, total] = await this.batchRepo.findAndCount({
      skip,
      take: limit,
      order: { created_at: 'DESC' },
    });

    // Annotate team counts per batch via a subquery
    const data = await Promise.all(
      batches.map(async (batch) => {
        const teamCount = await this.userRepo
          .createQueryBuilder('u')
          .innerJoin('team_members', 'tm', 'tm.user_id = u.id')
          .innerJoin('teams', 't', 't.id = tm.team_id AND t.batch_id = :batchId', { batchId: batch.id })
          .getCount();
        return { ...batch, team_count: teamCount };
      }),
    );

    this.logger.log('Owner batches fetched');
    return { data, total, page, limit };
  }

  async getCandidates(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [candidates, total] = await this.userRepo.findAndCount({
      where: { role: Role.CANDIDATE },
      skip,
      take: limit,
      order: { created_at: 'DESC' },
    });

    const data = await Promise.all(
      candidates.map(async (candidate) => {
        const assessments = await this.assessmentRepo.find({
          where: { user_id: candidate.id },
          order: { created_at: 'DESC' },
        });
        return { ...candidate, assessments };
      }),
    );

    this.logger.log('Owner candidates fetched');
    return { data, total, page, limit };
  }
}
