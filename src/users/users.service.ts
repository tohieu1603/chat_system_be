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
    this.logger.log(`findAllUsers: found ${total} users (page ${page})`);
    return { data, total, page, limit };
  }

  /** Create internal user (ADMIN/DEV/FINANCE) with hashed password */
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
