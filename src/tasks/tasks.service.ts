import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindManyOptions } from 'typeorm';
import { BaseService } from '../common/services/base.service';
import { Task } from '../entities/task.entity';
import { TaskComment } from '../entities/task-comment.entity';
import { User } from '../entities/user.entity';
import { Project } from '../entities/project.entity';
import { TaskStatus, Role } from '../common/enums';
import { AiService } from '../ai/ai.service';
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
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    private readonly aiService: AiService,
  ) {
    super(taskRepo);
  }

  async findAll(
    query: QueryTasksDto,
  ): Promise<{ data: Task[]; total: number; page: number; limit: number }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;

    const where: Record<string, any> = {};
    if (query.status) where['status'] = query.status;
    if (query.priority) where['priority'] = query.priority;
    if (query.assignee_id) where['assignee_id'] = query.assignee_id;

    const [data, total] = await this.taskRepo.findAndCount({
      where,
      relations: ['assignee', 'project'],
      skip,
      take: limit,
      order: { created_at: 'DESC' } as any,
    });
    this.logger.log(`findAll: total=${total}`);
    return { data, total, page, limit };
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

  /** AI generates tasks from project requirements and assigns to random DEV users */
  async generateTasks(projectId: string): Promise<Task[]> {
    // 1. Get project with requirement data
    const project = await this.projectRepo.findOneOrFail({ where: { id: projectId } });
    const reqData = project.requirement_json ?? project.collection_progress ?? {};

    if (!reqData || Object.keys(reqData).length === 0) {
      throw new BadRequestException('Dự án chưa có dữ liệu yêu cầu để tạo tasks');
    }

    // 2. Get all active DEV users
    const devUsers = await this.userRepo.find({
      where: { role: Role.DEV, is_active: true },
    });

    if (devUsers.length === 0) {
      throw new BadRequestException('Không có developer nào trong hệ thống');
    }

    // 3. Call AI to generate task list
    const prompt = `Bạn là project manager. Dựa trên tài liệu yêu cầu dự án "${project.project_name}" dưới đây, hãy tạo danh sách tasks cần làm.

Yêu cầu dự án:
${JSON.stringify(reqData, null, 2)}

Hãy trả về JSON array (KHÔNG có markdown, KHÔNG có text thừa) với format:
[
  {
    "title": "Tên task ngắn gọn",
    "description": "Mô tả chi tiết task cần làm",
    "task_type": "BACKEND|FRONTEND|DATABASE|DESIGN|DEVOPS|TESTING|OTHER",
    "priority": "LOW|MEDIUM|HIGH|URGENT",
    "estimated_hours": <số giờ ước tính>
  }
]

Quy tắc:
- Tạo 5-15 tasks tùy độ phức tạp dự án
- Chia nhỏ tasks theo chức năng cụ thể
- task_type phải là 1 trong: BACKEND, FRONTEND, DATABASE, DESIGN, DEVOPS, TESTING, OTHER
- priority phải là 1 trong: LOW, MEDIUM, HIGH, URGENT
- estimated_hours là số nguyên (2-40)
- Chỉ trả về JSON array, không có text khác`;

    const messages: any[] = [{ role: 'user', content: prompt }];
    let aiResponse = '';

    for await (const chunk of this.aiService.chat(messages, false)) {
      if (chunk.content) aiResponse += chunk.content;
    }

    // 4. Parse AI response
    let tasks: any[];
    try {
      // Extract JSON array from response (handle markdown wrapping)
      const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('No JSON array found');
      tasks = JSON.parse(jsonMatch[0]);
    } catch (e) {
      this.logger.error(`Failed to parse AI response: ${aiResponse}`);
      throw new BadRequestException('AI không thể tạo tasks, vui lòng thử lại');
    }

    // 5. Pick ONE random dev and assign ALL tasks to them
    const validTypes = ['BACKEND', 'FRONTEND', 'DATABASE', 'DESIGN', 'DEVOPS', 'TESTING', 'OTHER'];
    const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
    const assignedDev = devUsers[Math.floor(Math.random() * devUsers.length)];

    const createdTasks: Task[] = [];
    for (let i = 0; i < tasks.length; i++) {
      const t = tasks[i];

      const task = this.taskRepo.create({
        project_id: projectId,
        title: t.title || `Task ${i + 1}`,
        description: t.description || '',
        task_type: validTypes.includes(t.task_type) ? t.task_type : 'OTHER',
        priority: validPriorities.includes(t.priority) ? t.priority : 'MEDIUM',
        estimated_hours: Number(t.estimated_hours) || 8,
        assignee_id: assignedDev.id,
        sort_order: i,
        status: TaskStatus.TODO,
      });

      createdTasks.push(await this.taskRepo.save(task));
    }

    this.logger.log(`generateTasks: projectId=${projectId}, created=${createdTasks.length}, devs=${devUsers.length}`);
    return createdTasks;
  }
}
