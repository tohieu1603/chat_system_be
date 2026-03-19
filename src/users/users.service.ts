import {
  ConflictException, Injectable, Logger, NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { BaseService } from '../common/services/base.service';
import { User } from '../entities/user.entity';
import { Role } from '../common/enums';
import { CreateUserDto } from './dto/create-user.dto';
import { QueryUsersDto } from './dto/query-users.dto';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class UsersService extends BaseService<User> {
  protected readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User) repo: Repository<User>,
  ) {
    super(repo);
  }

  protected override get entityName(): string {
    return 'User';
  }

  /** Find user by email — optionally select hidden fields */
  async findByEmail(email: string, selectPassword = false): Promise<User | null> {
    const qb = this.repository
      .createQueryBuilder('user')
      .where('user.email = :email', { email });

    if (selectPassword) {
      qb.addSelect(['user.password_hash', 'user.refresh_token_hash']);
    }

    return qb.getOne();
  }

  /** Find user by email — throws if not found */
  async findByEmailOrFail(email: string, selectPassword = false): Promise<User> {
    const user = await this.findByEmail(email, selectPassword);
    if (!user) {
      this.logger.warn(`User not found: email=${email}`);
      throw new NotFoundException(`User with email "${email}" not found`);
    }
    return user;
  }

  /** List users with optional role filter and search */
  async findAllUsers(query: QueryUsersDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const qb = this.repository.createQueryBuilder('user');

    if (query.role) {
      qb.andWhere('user.role = :role', { role: query.role });
    }

    if (query.search) {
      qb.andWhere(
        '(user.full_name ILIKE :search OR user.email ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    qb.skip(skip).take(limit).orderBy('user.created_at', 'DESC');

    const [data, total] = await qb.getManyAndCount();

    // Enrich candidates with team/plan/assessment info
    if (query.role === Role.CANDIDATE && data.length > 0) {
      const userIds = data.map((u) => u.id);
      try {
        const mgr = this.repository.manager;

        const [teamRows, planRows, assessRows] = await Promise.all([
          mgr.query(
            `SELECT tm.user_id, t.name AS team_name FROM team_members tm JOIN teams t ON t.id = tm.team_id WHERE tm.user_id = ANY($1)`,
            [userIds],
          ).catch(() => []),
          mgr.query(
            `SELECT tm.user_id, bp.status AS plan_status FROM team_members tm JOIN business_plans bp ON bp.team_id = tm.team_id WHERE tm.user_id = ANY($1)`,
            [userIds],
          ).catch(() => []),
          mgr.query(
            `SELECT ta.user_id, (ta.business_thinking + ta.marketing_skills + ta.proactivity + ta.teamwork + ta.learning_ability + ta.pressure_handling) / 6.0 AS avg_score FROM talent_assessments ta WHERE ta.user_id = ANY($1)`,
            [userIds],
          ).catch(() => []),
        ]);

        const teamMap = new Map(teamRows.map((r: any) => [r.user_id, r.team_name]));
        const planMap = new Map(planRows.map((r: any) => [r.user_id, r.plan_status]));
        const assessMap = new Map(assessRows.map((r: any) => [r.user_id, parseFloat(r.avg_score)]));

        for (const u of data) {
          (u as any).team_name = teamMap.get(u.id) ?? null;
          (u as any).plan_status = planMap.get(u.id) ?? null;
          (u as any).assessment_avg = assessMap.get(u.id) ?? null;
        }
      } catch (e) {
        this.logger.warn(`Failed to enrich candidates: ${e}`);
      }
    }

    this.logger.log(`findAllUsers: found ${total} users (page ${page})`);
    return { data, total, page, limit };
  }

  /** Create internal user (ADMIN/DEV) with hashed password */
  async createInternalUser(dto: CreateUserDto): Promise<User> {
    const existing = await this.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException(`Email "${dto.email}" is already in use`);
    }

    const password_hash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    return this.create({
      email: dto.email,
      password_hash,
      full_name: dto.full_name,
      phone: dto.phone,
      role: dto.role as Role,
    });
  }

  /** Soft delete — sets is_active = false */
  async softDelete(id: string): Promise<void> {
    const user = await this.findByIdOrFail(id);
    user.is_active = false;
    await this.repository.save(user);
    this.logger.log(`Soft deleted User: id=${id}`);
  }

  /** Find user with refresh token hash selected */
  async findWithRefreshToken(id: string): Promise<User | null> {
    return this.repository
      .createQueryBuilder('user')
      .addSelect('user.refresh_token_hash')
      .where('user.id = :id', { id })
      .getOne();
  }

  /** Find user with password reset token selected */
  async findWithResetToken(hashedToken: string): Promise<User | null> {
    return this.repository
      .createQueryBuilder('user')
      .addSelect(['user.password_reset_token', 'user.password_hash'])
      .where('user.password_reset_token = :token', { token: hashedToken })
      .getOne();
  }
}
