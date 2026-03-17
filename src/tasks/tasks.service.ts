import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindManyOptions } from 'typeorm';
import { BaseService } from '../common/services/base.service';
import { Task } from '../entities/task.entity';
import { TaskComment } from '../entities/task-comment.entity';
import { TaskStatus } from '../common/enums';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { QueryTasksDto } from './dto/query-tasks.dto';

const VALID_TRANSITIONS: Partial<Record<TaskStatus, TaskStatus[]>> = {
  [TaskStatus.TODO]: [TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED],
  [TaskStatus.IN_PROGRESS]: [TaskStatus.IN_REVIEW, TaskStatus.BLOCKED, TaskStatus.TODO],
  [TaskStatus.IN_REVIEW]: [TaskStatus.DONE, TaskStatus.IN_PROGRESS],
  [TaskStatus.BLOCKED]: [TaskStatus.TODO, TaskStatus.IN_PROGRESS],
  [TaskStatus.DONE]: [TaskStatus.IN_PROGRESS],
};

@Injectable()
export class TasksService extends BaseService<Task> {
  protected readonly logger = new Logger(TasksService.name);

  constructor(
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
    @InjectRepository(TaskComment)
    private readonly commentRepo: Repository<TaskComment>,
  ) {
    super(taskRepo);
  }

  async findByProject(
    projectId: string,
    query: QueryTasksDto,
  ): Promise<{ data: Task[]; total: number; page: number; limit: number }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Record<string, any> = { project_id: projectId };
    if (query.status) where['status'] = query.status;
    if (query.priority) where['priority'] = query.priority;
    if (query.assignee_id) where['assignee_id'] = query.assignee_id;

    const options: FindManyOptions<Task> = {
      where,
      relations: ['assignee'],
      skip,
      take: limit,
      order: { sort_order: 'ASC', created_at: 'DESC' } as any,
    };

    const [data, total] = await this.taskRepo.findAndCount(options);
    this.logger.log(`findByProject: projectId=${projectId}, total=${total}`);
    return { data, total, page, limit };
  }

  async findMyTasks(
    userId: string,
    query: QueryTasksDto,
  ): Promise<{ data: Task[]; total: number; page: number; limit: number }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Record<string, any> = { assignee_id: userId };
    if (query.status) where['status'] = query.status;
    if (query.priority) where['priority'] = query.priority;

    const [data, total] = await this.taskRepo.findAndCount({
      where,
      relations: ['project', 'assignee'],
      skip,
      take: limit,
      order: { due_date: 'ASC', created_at: 'DESC' } as any,
    });

    this.logger.log(`findMyTasks: userId=${userId}, total=${total}`);
    return { data, total, page, limit };
  }

  async createTask(projectId: string, dto: CreateTaskDto): Promise<Task> {
    const task = this.taskRepo.create({ ...dto, project_id: projectId });
    const saved = await this.taskRepo.save(task);
    this.logger.log(`createTask: projectId=${projectId}, taskId=${saved.id}`);
    return saved;
  }

  async updateTask(id: string, dto: UpdateTaskDto): Promise<Task> {
    return this.update(id, dto as any);
  }

  async updateStatus(id: string, status: TaskStatus): Promise<Task> {
    const task = await this.findByIdOrFail(id);
    const allowed = VALID_TRANSITIONS[task.status] ?? [];

    if (!allowed.includes(status)) {
      throw new BadRequestException(
        `Invalid transition: ${task.status} -> ${status}. Allowed: ${allowed.join(', ')}`,
      );
    }

    task.status = status;
    const updated = await this.taskRepo.save(task);
    this.logger.log(`updateStatus: id=${id}, ${task.status} -> ${status}`);
    return updated;
  }

  async assignTask(id: string, assigneeId: string): Promise<Task> {
    const task = await this.findByIdOrFail(id);
    task.assignee_id = assigneeId;
    const updated = await this.taskRepo.save(task);
    this.logger.log(`assignTask: id=${id}, assigneeId=${assigneeId}`);
    return updated;
  }

  async addComment(taskId: string, userId: string, content: string): Promise<TaskComment> {
    const comment = this.commentRepo.create({ task_id: taskId, user_id: userId, content });
    const saved = await this.commentRepo.save(comment);
    this.logger.log(`addComment: taskId=${taskId}, userId=${userId}`);
    return saved;
  }

  async getComments(taskId: string): Promise<TaskComment[]> {
    const comments = await this.commentRepo.find({
      where: { task_id: taskId },
      relations: ['user'],
      order: { created_at: 'ASC' } as any,
    });
    this.logger.log(`getComments: taskId=${taskId}, count=${comments.length}`);
    return comments;
  }
}
