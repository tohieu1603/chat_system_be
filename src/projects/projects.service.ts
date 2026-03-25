import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseService } from '../common/services/base.service';
import { Project } from '../entities/project.entity';
import { ProjectMember } from '../entities/project-member.entity';
import { Conversation } from '../entities/conversation.entity';
import { CollectionData } from '../entities/collection-data.entity';
import {
  CollectionCategory,
  ConversationStatus,
  ConversationType,
  ProjectStatus,
  Role,
} from '../common/enums';
import { CreateProjectDto } from './dto/create-project.dto';
import { QueryProjectsDto } from './dto/query-projects.dto';

const REQUIRED_CATEGORIES = new Set([
  CollectionCategory.COMPANY_INFO, CollectionCategory.DEPARTMENTS,
  CollectionCategory.EMPLOYEES, CollectionCategory.WORKFLOWS,
  CollectionCategory.FEATURES, CollectionCategory.PRIORITIES,
]);

const STATUS_TRANSITIONS: Record<ProjectStatus, ProjectStatus[]> = {
  [ProjectStatus.COLLECTING]: [ProjectStatus.COLLECTED, ProjectStatus.ON_HOLD],
  [ProjectStatus.COLLECTED]: [ProjectStatus.REVIEWING, ProjectStatus.COLLECTING, ProjectStatus.ON_HOLD],
  [ProjectStatus.REVIEWING]: [ProjectStatus.APPROVED, ProjectStatus.COLLECTED, ProjectStatus.ON_HOLD],
  [ProjectStatus.APPROVED]: [ProjectStatus.IN_PROGRESS, ProjectStatus.ON_HOLD],
  [ProjectStatus.IN_PROGRESS]: [ProjectStatus.COMPLETED, ProjectStatus.ON_HOLD],
  [ProjectStatus.COMPLETED]: [],
  [ProjectStatus.ON_HOLD]: [ProjectStatus.COLLECTING, ProjectStatus.COLLECTED, ProjectStatus.REVIEWING, ProjectStatus.IN_PROGRESS],
};

@Injectable()
export class ProjectsService extends BaseService<Project> {
  protected readonly logger = new Logger(ProjectsService.name);

  constructor(
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectRepository(ProjectMember)
    private readonly memberRepository: Repository<ProjectMember>,
    @InjectRepository(Conversation)
    private readonly conversationRepository: Repository<Conversation>,
    @InjectRepository(CollectionData)
    private readonly collectionDataRepo: Repository<CollectionData>,
  ) {
    super(projectRepository);
  }

  private async generateProjectCode(): Promise<string> {
    const result = await this.projectRepository
      .createQueryBuilder('p')
      .select('MAX(p.project_code)', 'maxCode')
      .getRawOne<{ maxCode: string | null }>();

    const maxCode = result?.maxCode;
    let nextNumber = 1;

    if (maxCode) {
      const match = maxCode.match(/^PRJ-(\d+)$/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }

    return `PRJ-${String(nextNumber).padStart(3, '0')}`;
  }

  private buildInitialProgress(): Record<string, any> {
    const nine = [
      CollectionCategory.COMPANY_INFO, CollectionCategory.DEPARTMENTS,
      CollectionCategory.EMPLOYEES, CollectionCategory.WORKFLOWS,
      CollectionCategory.SALARY, CollectionCategory.SCHEDULING,
      CollectionCategory.FEATURES, CollectionCategory.SPECIAL_REQUIREMENTS,
      CollectionCategory.PRIORITIES,
    ];
    return nine.reduce<Record<string, any>>((acc, cat) => {
      acc[cat] = { status: 'not_started', required: REQUIRED_CATEGORIES.has(cat), fields_collected: [], fields_missing: [], last_updated: null };
      return acc;
    }, {});
  }

  async createProject(
    customerId: string,
    dto: CreateProjectDto,
  ): Promise<Project & { conversation_id: string }> {
    this.logger.log(`Creating project for customer ${customerId}`);

    // Giới hạn 3 dự án / user
    const count = await this.projectRepository.count({ where: { customer_id: customerId } });
    if (count >= 3) {
      throw new BadRequestException('Bạn chỉ được tạo tối đa 3 dự án');
    }

    const project_code = await this.generateProjectCode();
    const collection_progress = this.buildInitialProgress();

    const project = await this.create({
      customer_id: customerId,
      project_name: dto.project_name,
      description: dto.description,
      project_code,
      status: ProjectStatus.COLLECTING,
      collection_progress,
    });

    const conversation = this.conversationRepository.create({
      project_id: project.id,
      title: `AI Collection — ${dto.project_name}`,
      conversation_type: ConversationType.AI_COLLECT,
      status: ConversationStatus.ACTIVE,
    });
    const savedConversation = await this.conversationRepository.save(conversation);

    this.logger.log(
      `Project ${project_code} created (id=${project.id}), conversation id=${savedConversation.id}`,
    );

    return { ...project, conversation_id: savedConversation.id };
  }

  async findAllByRole(
    userId: string,
    role: Role,
    query: QueryProjectsDto,
  ): Promise<{ data: Project[]; total: number; page: number; limit: number }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const qb = this.projectRepository
      .createQueryBuilder('project')
      .leftJoinAndSelect('project.customer', 'customer')
      .skip(skip)
      .take(limit)
      .orderBy('project.created_at', 'DESC');

    if (query.status) {
      qb.andWhere('project.status = :status', { status: query.status });
    }

    if (role === Role.DEV) {
      qb.innerJoin(
        'project_members',
        'pm',
        'pm.project_id = project.id AND pm.user_id = :userId',
        { userId },
      );
    } else if (role !== Role.ADMIN) {
      // CANDIDATE/CUSTOMER only sees own projects
      qb.andWhere('project.customer_id = :userId', { userId });
    }
    // ADMIN sees all projects

    const [data, total] = await qb.getManyAndCount();

    this.logger.log(`findAllByRole role=${role} userId=${userId}: ${total} projects`);
    return { data, total, page, limit };
  }

  async updateStatus(id: string, newStatus: ProjectStatus): Promise<Project> {
    const project = await this.findByIdOrFail(id);
    const allowed = STATUS_TRANSITIONS[project.status] ?? [];

    if (!allowed.includes(newStatus)) {
      throw new BadRequestException(
        `Cannot transition from ${project.status} to ${newStatus}`,
      );
    }

    this.logger.log(`Project ${id}: status ${project.status} -> ${newStatus}`);
    return this.update(id, { status: newStatus });
  }

  async getMembers(projectId: string): Promise<ProjectMember[]> {
    return this.memberRepository.find({
      where: { project_id: projectId },
      relations: ['user'],
    });
  }

  async addMember(
    projectId: string,
    userId: string,
    role: string,
  ): Promise<ProjectMember> {
    await this.findByIdOrFail(projectId);

    this.logger.log(`Adding user ${userId} to project ${projectId} as ${role}`);
    const member = this.memberRepository.create({ project_id: projectId, user_id: userId, role });
    return this.memberRepository.save(member);
  }

  async getProgress(id: string): Promise<Record<string, any>> {
    const project = await this.findByIdOrFail(id);
    return project.collection_progress;
  }

  async getDocument(id: string): Promise<{ requirement_doc_url: string | null; requirement_json: Record<string, any> | null }> {
    const project = await this.findByIdOrFail(id);
    return {
      requirement_doc_url: project.requirement_doc_url ?? null,
      requirement_json: project.requirement_json ?? null,
    };
  }

  /** Generate requirement document from collection data */
  async generateDocument(projectId: string): Promise<Project> {
    const project = await this.findByIdOrFail(projectId);
    const allData = await this.collectionDataRepo.find({
      where: { project_id: projectId },
      order: { created_at: 'ASC' },
    });

    this.logger.log(`generateDocument: ${allData.length} entries for project ${projectId}`);

    // Build structured JSON
    const requirementJson: Record<string, any> = {
      project_name: project.project_name,
      project_code: project.project_code,
      generated_at: new Date().toISOString(),
      summary: project.collection_progress?.['summary'] ?? '',
      sections: {} as Record<string, any>,
    };

    const LABELS: Record<string, string> = {
      COMPANY_INFO: 'Thông tin công ty',
      DEPARTMENTS: 'Cơ cấu tổ chức',
      EMPLOYEES: 'Nhân sự & vị trí',
      WORKFLOWS: 'Quy trình làm việc',
      SALARY: 'Tính lương & chấm công',
      SCHEDULING: 'Lịch làm việc',
      FEATURES: 'Yêu cầu tính năng',
      SPECIAL_REQUIREMENTS: 'Yêu cầu đặc biệt',
      PRIORITIES: 'Ưu tiên & Timeline',
    };

    for (const entry of allData) {
      const section = requirementJson.sections[entry.category] ?? { label: LABELS[entry.category] ?? entry.category, data: {} };
      section.data = { ...section.data, ...entry.data_value };
      requirementJson.sections[entry.category] = section;
    }

    // Build markdown
    let md = `# Báo cáo Yêu cầu Phần mềm\n\n`;
    md += `**Dự án:** ${project.project_name}\n`;
    md += `**Mã:** ${project.project_code}\n`;
    md += `**Ngày tạo:** ${new Date().toLocaleDateString('vi-VN')}\n\n`;
    if (requirementJson.summary) {
      md += `## Tóm tắt\n${requirementJson.summary}\n\n`;
    }
    md += `---\n\n`;

    for (const [cat, section] of Object.entries(requirementJson.sections) as [string, any][]) {
      md += `## ${section.label}\n\n`;
      md += this.renderSectionMd(section.data);
      md += `\n---\n\n`;
    }

    // Save to project via direct update (avoid full entity save issues)
    const docUrl = `data:text/markdown;base64,${Buffer.from(md, 'utf-8').toString('base64')}`;
    await this.projectRepository.update(projectId, {
      requirement_json: requirementJson,
      requirement_doc_url: docUrl,
    });

    this.logger.log(`Document generated for project ${projectId}`);
    return { ...project, requirement_json: requirementJson, requirement_doc_url: docUrl };
  }

  private renderSectionMd(data: Record<string, any>, indent = ''): string {
    let md = '';
    for (const [key, val] of Object.entries(data)) {
      const label = key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      if (Array.isArray(val)) {
        md += `${indent}**${label}:**\n`;
        for (const item of val) {
          if (typeof item === 'object' && item !== null) {
            md += `${indent}- `;
            const parts = Object.entries(item).map(([k, v]) => `${k}: ${v}`);
            md += parts.join(', ') + '\n';
          } else {
            md += `${indent}- ${item}\n`;
          }
        }
      } else if (typeof val === 'object' && val !== null) {
        md += `${indent}**${label}:**\n`;
        md += this.renderSectionMd(val, indent + '  ');
      } else {
        md += `${indent}**${label}:** ${val}\n`;
      }
    }
    return md;
  }
}
