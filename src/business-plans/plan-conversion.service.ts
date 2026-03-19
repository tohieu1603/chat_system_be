import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BusinessPlan } from '../entities/business-plan.entity';
import { Project } from '../entities/project.entity';
import { ProjectMember } from '../entities/project-member.entity';
import { Notification } from '../entities/notification.entity';
import { Task } from '../entities/task.entity';
import { User } from '../entities/user.entity';
import { PlanStatus, ProjectStatus, NotificationType, Priority, Role, TaskStatus } from '../common/enums';
import { AiService } from '../ai/ai.service';

@Injectable()
export class PlanConversionService {
  private readonly logger = new Logger(PlanConversionService.name);

  constructor(
    @InjectRepository(BusinessPlan)
    private readonly planRepo: Repository<BusinessPlan>,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @InjectRepository(ProjectMember)
    private readonly projectMemberRepo: Repository<ProjectMember>,
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly aiService: AiService,
    private readonly dataSource: DataSource,
  ) {}

  async convertToProject(planId: string, adminUserId: string): Promise<Project> {
    const plan = await this.planRepo.findOne({ where: { id: planId } });

    if (!plan) throw new NotFoundException(`BusinessPlan id=${planId} not found`);
    if (plan.status !== PlanStatus.APPROVED) {
      throw new BadRequestException(`Plan must be APPROVED. Current: ${plan.status}`);
    }

    const projectCode = await this.generateProjectCode();

    // Get all DEVs in system to assign tasks
    const devs = await this.userRepo.find({ where: { role: Role.DEV, is_active: true } });
    if (devs.length === 0) {
      throw new BadRequestException('Không có DEV nào trong hệ thống để giao task.');
    }

    return this.dataSource.transaction(async (manager) => {
      // 1. Create project
      const project = manager.create(Project, {
        customer_id: adminUserId,
        project_name: plan.title,
        project_code: projectCode,
        description: plan.executive_summary ?? plan.solution ?? undefined,
        status: ProjectStatus.IN_PROGRESS,
        collection_progress: {},
        priority: Priority.MEDIUM,
      });
      const savedProject = await manager.save(Project, project);

      // 2. Chọn 1 DEV ít dự án nhất (round-robin theo số project)
      const devWorkloads = await Promise.all(
        devs.map(async (d) => {
          const count = await manager.count(ProjectMember, { where: { user_id: d.id } });
          return { dev: d, projectCount: count };
        }),
      );
      devWorkloads.sort((a, b) => a.projectCount - b.projectCount);
      const assignedDev = devWorkloads[0].dev;

      // 3. AI tạo tasks từ kế hoạch → giao hết cho 1 DEV
      const tasks = await this.generateTasksFromPlan(plan);
      const createdTasks = tasks.map((t, i) =>
        manager.create(Task, {
          project_id: savedProject.id,
          title: t.title,
          description: t.description,
          status: TaskStatus.TODO,
          priority: t.priority ?? Priority.MEDIUM,
          assignee_id: assignedDev.id,
          sort_order: i,
        }),
      );
      await manager.save(Task, createdTasks);

      // 4. DEV là thành viên duy nhất của dự án
      await manager.save(ProjectMember, manager.create(ProjectMember, {
        project_id: savedProject.id,
        user_id: assignedDev.id,
        role: 'DEV',
      }));

      // 5. Notify DEV
      await manager.save(Notification, manager.create(Notification, {
        user_id: assignedDev.id,
        title: `Dự án mới: ${plan.title}`,
        content: `Bạn được giao dự án "${plan.title}" (${projectCode}) với ${createdTasks.length} tasks.`,
        type: NotificationType.TASK_ASSIGNED,
        reference_type: 'project',
        reference_id: savedProject.id,
      }));

      this.logger.log(
        `Plan ${planId} → Project ${savedProject.id} (${projectCode}). ${createdTasks.length} tasks → DEV ${assignedDev.full_name}`,
      );

      return savedProject;
    });
  }

  /** AI reads business plan and generates task list */
  private async generateTasksFromPlan(
    plan: BusinessPlan,
  ): Promise<Array<{ title: string; description: string; priority: Priority }>> {
    const planContent = [
      `Tên dự án: ${plan.title}`,
      `Tóm tắt: ${plan.executive_summary ?? ''}`,
      `Vấn đề: ${plan.problem_statement ?? ''}`,
      `Giải pháp: ${plan.solution ?? ''}`,
      `Thị trường: ${plan.target_market ?? ''}`,
      `Marketing: ${plan.organic_marketing ?? ''}`,
      `Vận hành: ${plan.operation_workflow ?? ''}`,
      `Công nghệ: ${plan.tech_requirements ?? ''}`,
      `Tài chính: ${plan.cost_structure ?? ''} ${plan.revenue_model ?? ''}`,
    ]
      .filter((s) => !s.endsWith(': '))
      .join('\n');

    const prompt = `Dựa trên kế hoạch kinh doanh sau, hãy tạo danh sách tasks cụ thể để triển khai dự án. Số lượng tùy theo độ phức tạp của kế hoạch.

${planContent}

Trả về JSON array, mỗi item có: title, description, priority (HIGH/MEDIUM/LOW).
Chỉ trả JSON, không giải thích thêm. Ví dụ:
[{"title":"Thiết kế UI app","description":"Thiết kế giao diện...","priority":"HIGH"}]`;

    try {
      const messages: Array<{ role: 'system' | 'user'; content: string }> = [
        { role: 'system', content: 'Bạn là project manager. Trả về JSON array tasks. Không markdown, không giải thích.' },
        { role: 'user', content: prompt },
      ];

      let fullResponse = '';
      for await (const chunk of this.aiService.chat(messages, false)) {
        if (chunk.content) fullResponse += chunk.content;
        if (chunk.isDone) break;
      }

      // Extract JSON from response
      const jsonMatch = fullResponse.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        this.logger.warn('AI did not return valid JSON, using fallback tasks');
        return this.fallbackTasks(plan);
      }

      const parsed = JSON.parse(jsonMatch[0]) as Array<{ title: string; description: string; priority: string }>;
      return parsed.map((t) => ({
        title: t.title,
        description: t.description,
        priority: (t.priority === 'HIGH' ? Priority.HIGH : t.priority === 'LOW' ? Priority.LOW : Priority.MEDIUM),
      }));
    } catch (err) {
      this.logger.error(`AI task generation failed: ${err}`);
      return this.fallbackTasks(plan);
    }
  }

  /** Fallback tasks if AI fails */
  private fallbackTasks(plan: BusinessPlan): Array<{ title: string; description: string; priority: Priority }> {
    return [
      { title: 'Nghiên cứu thị trường', description: `Phân tích thị trường cho "${plan.title}"`, priority: Priority.HIGH },
      { title: 'Thiết kế sản phẩm/dịch vụ', description: 'Thiết kế chi tiết sản phẩm/dịch vụ cốt lõi', priority: Priority.HIGH },
      { title: 'Xây dựng hệ thống công nghệ', description: plan.tech_requirements ?? 'Setup hạ tầng kỹ thuật', priority: Priority.MEDIUM },
      { title: 'Triển khai marketing', description: plan.organic_marketing ?? 'Lên kế hoạch marketing', priority: Priority.MEDIUM },
      { title: 'Thiết lập vận hành', description: plan.operation_workflow ?? 'Thiết lập quy trình vận hành', priority: Priority.MEDIUM },
      { title: 'Quản lý tài chính', description: plan.cost_structure ?? 'Theo dõi chi phí và doanh thu', priority: Priority.LOW },
    ];
  }

  private async generateProjectCode(): Promise<string> {
    const result = await this.projectRepo
      .createQueryBuilder('p')
      .select('MAX(p.project_code)', 'maxCode')
      .getRawOne<{ maxCode: string | null }>();

    const maxCode = result?.maxCode;
    let nextNumber = 1;
    if (maxCode) {
      const match = maxCode.match(/^PRJ-(\d+)$/);
      if (match) nextNumber = parseInt(match[1], 10) + 1;
    }
    return `PRJ-${String(nextNumber).padStart(3, '0')}`;
  }
}
