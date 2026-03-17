import { Logger, NotFoundException } from '@nestjs/common';
import {
  Repository, DeepPartial, FindOptionsWhere, FindManyOptions,
} from 'typeorm';
import { PaginationDto } from '../dto/pagination.dto';

/**
 * Abstract base service — provides common CRUD operations.
 * All domain services extend this to avoid code duplication.
 */
export abstract class BaseService<T extends { id: string }> {
  protected abstract readonly logger: Logger;

  constructor(protected readonly repository: Repository<T>) {}

  /** Find all with pagination */
  async findAll(
    query: PaginationDto,
    options?: FindManyOptions<T>,
  ): Promise<{ data: T[]; total: number; page: number; limit: number }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const [data, total] = await this.repository.findAndCount({
      ...options,
      skip,
      take: limit,
    });

    this.logger.log(`findAll: found ${total} records (page ${page})`);
    return { data, total, page, limit };
  }

  /** Find one by ID — throws NotFoundException if null */
  async findByIdOrFail(id: string, relations?: string[]): Promise<T> {
    const entity = await this.repository.findOne({
      where: { id } as FindOptionsWhere<T>,
      relations,
    });

    if (!entity) {
      this.logger.warn(`Entity not found: id=${id}`);
      throw new NotFoundException(`${this.entityName} with id "${id}" not found`);
    }

    return entity;
  }

  /** Find one by ID — returns null if not found */
  async findById(id: string, relations?: string[]): Promise<T | null> {
    return this.repository.findOne({
      where: { id } as FindOptionsWhere<T>,
      relations,
    });
  }

  /** Find one by conditions — returns null if not found */
  async findOne(where: FindOptionsWhere<T>, relations?: string[]): Promise<T | null> {
    return this.repository.findOne({ where, relations });
  }

  /** Create and save a new entity */
  async create(data: DeepPartial<T>): Promise<T> {
    const entity = this.repository.create(data);
    const saved = await this.repository.save(entity);
    this.logger.log(`Created ${this.entityName}: id=${(saved as any).id}`);
    return saved;
  }

  /** Update an existing entity — throws if not found */
  async update(id: string, data: DeepPartial<T>): Promise<T> {
    const entity = await this.findByIdOrFail(id);
    Object.assign(entity, data);
    const updated = await this.repository.save(entity);
    this.logger.log(`Updated ${this.entityName}: id=${id}`);
    return updated;
  }

  /** Hard delete — throws if not found */
  async remove(id: string): Promise<void> {
    const entity = await this.findByIdOrFail(id);
    await this.repository.remove(entity);
    this.logger.log(`Removed ${this.entityName}: id=${id}`);
  }

  /** Count records matching conditions */
  async count(where?: FindOptionsWhere<T>): Promise<number> {
    return this.repository.count({ where });
  }

  /** Entity name for logging — derived from class name */
  protected get entityName(): string {
    return this.constructor.name.replace('Service', '');
  }
}
