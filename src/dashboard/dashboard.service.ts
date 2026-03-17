import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from '../entities/project.entity';
import { User } from '../entities/user.entity';
import { Task } from '../entities/task.entity';
import { ProjectStatus, Role } from '../common/enums';

export interface DashboardStats {
  total_projects: number;
  active_projects: number;
  total_customers: number;
  projects_by_status: Record<string, number>;
  revenue_summary: { total_paid: number; total_pending: number };
}

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
  ) {}

  async getStats(): Promise<DashboardStats> {
    const [total_projects, active_projects, total_customers] = await Promise.all([
      this.projectRepo.count(),
      this.projectRepo.count({ where: { status: ProjectStatus.IN_PROGRESS } }),
      this.userRepo.count({ where: { role: Role.CUSTOMER } }),
    ]);

    const statusRows = await this.projectRepo
      .createQueryBuilder('p')
      .select('p.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('p.status')
      .getRawMany<{ status: string; count: string }>();

    const projects_by_status = statusRows.reduce<Record<string, number>>((acc, row) => {
      acc[row.status] = parseInt(row.count, 10);
      return acc;
    }, {});

    const revenueRows = await this.projectRepo.manager
      .createQueryBuilder()
      .select('f.status', 'status')
      .addSelect('SUM(f.amount)', 'total')
      .from('finance_records', 'f')
      .where("f.status IN ('PAID', 'PENDING')")
      .groupBy('f.status')
      .getRawMany<{ status: string; total: string }>();

    const revenue_summary = { total_paid: 0, total_pending: 0 };
    for (const row of revenueRows) {
      if (row.status === 'PAID') revenue_summary.total_paid = parseFloat(row.total ?? '0');
      if (row.status === 'PENDING') revenue_summary.total_pending = parseFloat(row.total ?? '0');
    }

    this.logger.log(`getStats: total_projects=${total_projects}, active=${active_projects}`);
    return { total_projects, active_projects, total_customers, projects_by_status, revenue_summary };
  }

  async getRecentActivity(limit = 10): Promise<Project[]> {
    const projects = await this.projectRepo.find({
      relations: ['customer'],
      order: { updated_at: 'DESC' } as any,
      take: limit,
    });
    this.logger.log(`getRecentActivity: returned ${projects.length} projects`);
    return projects;
  }
}
