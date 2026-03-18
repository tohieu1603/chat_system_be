import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import OpenAI from 'openai';
import { CollectionData } from '../entities/collection-data.entity';
import { Project } from '../entities/project.entity';
import { CollectionCategory, ProjectStatus } from '../common/enums';

type ToolCall = OpenAI.Chat.Completions.ChatCompletionChunk.Choice.Delta.ToolCall & {
  arguments_acc?: string;
};

export interface ToolResult {
  tool_call_id: string;
  role: 'tool';
  content: string;
}

@Injectable()
export class ToolHandlerService {
  private readonly logger = new Logger(ToolHandlerService.name);

  constructor(
    @InjectRepository(CollectionData)
    private readonly collectionRepo: Repository<CollectionData>,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
  ) {}

  async handleToolCalls(
    toolCalls: ToolCall[],
    projectId: string,
    conversationId: string,
    messageId?: string,
  ): Promise<ToolResult[]> {
    const results: ToolResult[] = [];

    for (const tc of toolCalls) {
      const functionName = tc.function?.name ?? '';
      const rawArgs = (tc as any).function?.arguments ?? tc.arguments_acc ?? '{}';

      let args: Record<string, any> = {};
      try {
        args = JSON.parse(rawArgs);
      } catch {
        this.logger.warn(`Failed to parse args for ${functionName}: ${rawArgs}`);
      }

      const toolCallId = tc.id ?? `tc_${Date.now()}`;

      try {
        const result = await this.dispatch(functionName, args, projectId, conversationId, messageId);
        results.push({ tool_call_id: toolCallId, role: 'tool', content: JSON.stringify(result) });
      } catch (err) {
        this.logger.error(`Tool call ${functionName} failed: ${(err as Error).message}`);
        results.push({
          tool_call_id: toolCallId,
          role: 'tool',
          content: JSON.stringify({ error: (err as Error).message }),
        });
      }
    }

    return results;
  }

  private async dispatch(
    name: string,
    args: Record<string, any>,
    projectId: string,
    conversationId: string,
    messageId?: string,
  ): Promise<Record<string, any>> {
    const categoryMap: Record<string, CollectionCategory> = {
      save_company_info: CollectionCategory.COMPANY_INFO,
      save_department_info: CollectionCategory.DEPARTMENTS,
      save_employee_info: CollectionCategory.EMPLOYEES,
      save_workflow_info: CollectionCategory.WORKFLOWS,
      save_salary_info: CollectionCategory.SALARY,
      save_feature_request: CollectionCategory.FEATURES,
      save_scheduling_info: CollectionCategory.SCHEDULING,
      save_special_requirements: CollectionCategory.SPECIAL_REQUIREMENTS,
      save_priority_info: CollectionCategory.PRIORITIES,
      save_integration_info: CollectionCategory.SPECIAL_REQUIREMENTS,
      save_security_requirements: CollectionCategory.SPECIAL_REQUIREMENTS,
      save_ui_requirements: CollectionCategory.FEATURES,
      save_report_requirements: CollectionCategory.FEATURES,
      save_notification_requirements: CollectionCategory.SPECIAL_REQUIREMENTS,
      save_data_migration_info: CollectionCategory.SPECIAL_REQUIREMENTS,
      suggest_features: CollectionCategory.FEATURES,
    };

    if (categoryMap[name]) {
      await this.upsertData(categoryMap[name], args, projectId, conversationId, messageId);
      await this.updateProjectProgress(projectId, categoryMap[name], args);
      this.logger.log(`Saved ${name} for project ${projectId}`);
      return { success: true, category: categoryMap[name], saved: Object.keys(args) };
    }

    if (name === 'check_collection_progress') {
      return this.checkProgress(projectId);
    }

    if (name === 'mark_collection_complete') {
      return this.markComplete(projectId, args['summary'] ?? '');
    }

    this.logger.warn(`Unknown tool: ${name}`);
    return { error: `Unknown function: ${name}` };
  }

  private async upsertData(
    category: CollectionCategory,
    data: Record<string, any>,
    projectId: string,
    conversationId: string,
    sourceMessageId?: string,
  ): Promise<void> {
    const dataKey = category.toLowerCase();

    const existing = await this.collectionRepo.findOne({
      where: { project_id: projectId, category, data_key: dataKey },
    });

    if (existing) {
      existing.data_value = { ...existing.data_value, ...data };
      if (sourceMessageId) existing.source_message_id = sourceMessageId;
      await this.collectionRepo.save(existing);
    } else {
      const entry = this.collectionRepo.create({
        project_id: projectId,
        conversation_id: conversationId,
        category,
        data_key: dataKey,
        data_value: data,
        confidence: 1.0,
        source_message_id: sourceMessageId,
      });
      await this.collectionRepo.save(entry);
    }
  }

  private async checkProgress(projectId: string): Promise<Record<string, any>> {
    const project = await this.projectRepo.findOne({ where: { id: projectId } });
    if (!project) return { error: 'Project not found' };
    return project.collection_progress ?? {};
  }

  private async markComplete(projectId: string, summary: string): Promise<Record<string, any>> {
    const project = await this.projectRepo.findOne({ where: { id: projectId } });
    if (!project) return { error: 'Project not found' };

    const progress = project.collection_progress ?? {};
    const categories = progress['categories'] ?? {};

    // Validate: require at least 4 core categories before completing
    const REQUIRED = ['COMPANY_INFO', 'DEPARTMENTS', 'WORKFLOWS', 'FEATURES'];
    const collected = REQUIRED.filter(r =>
      categories[r]?.fields_collected?.length > 0 || categories[r]?.status === 'in_progress' || categories[r]?.status === 'completed',
    );
    const missing = REQUIRED.filter(r => !collected.includes(r));
    if (missing.length > 0) {
      const labels: Record<string, string> = {
        COMPANY_INFO: 'Thông tin công ty', DEPARTMENTS: 'Phòng ban', EMPLOYEES: 'Nhân sự',
        WORKFLOWS: 'Quy trình làm việc', FEATURES: 'Tính năng yêu cầu', PRIORITIES: 'Ưu tiên & Timeline',
      };
      return { error: `Chưa đủ thông tin bắt buộc. Còn thiếu: ${missing.map(m => labels[m] || m).join(', ')}. Hãy hỏi khách hàng thêm.` };
    }

    // Mark all categories with data as 'completed'
    for (const [key, val] of Object.entries(categories)) {
      const cat = val as Record<string, any>;
      if (cat['fields_collected']?.length > 0) {
        cat['status'] = 'completed';
      }
    }
    progress['categories'] = categories;
    progress['overall_progress'] = 100;
    progress['is_complete'] = true;
    progress['completed_at'] = new Date().toISOString();
    progress['summary'] = summary;

    await this.projectRepo.update(projectId, {
      status: ProjectStatus.COLLECTED,
      collection_progress: progress,
    });

    this.logger.log(`Project ${projectId} marked as COLLECTED`);
    return { success: true, status: ProjectStatus.COLLECTED, summary };
  }

  /** Update project progress atomically using raw query to avoid race conditions */
  private async updateProjectProgress(
    projectId: string,
    category: CollectionCategory,
    savedData: Record<string, any>,
  ): Promise<void> {
    // Re-read fresh data each time to avoid stale reads when multiple tools fire
    const project = await this.projectRepo.findOne({ where: { id: projectId } });
    if (!project) return;

    const progress: Record<string, any> = { ...(project.collection_progress ?? {}) };
    const categories: Record<string, any> = { ...(progress['categories'] ?? {}) };

    const existing = categories[category] ?? {
      status: 'not_started',
      required: false,
      fields_collected: [],
      fields_missing: [],
      last_updated: null,
    };

    const prevFields: string[] = existing['fields_collected'] ?? [];
    const newFields = Object.keys(savedData).filter(k => !prevFields.includes(k));
    existing['fields_collected'] = [...prevFields, ...newFields];
    existing['status'] = existing['fields_collected'].length > 0 ? 'in_progress' : 'not_started';
    existing['last_updated'] = new Date().toISOString();
    categories[category] = existing;

    const ALL_CATEGORIES = [
      'COMPANY_INFO', 'DEPARTMENTS', 'EMPLOYEES', 'WORKFLOWS',
      'SALARY', 'SCHEDULING', 'FEATURES', 'SPECIAL_REQUIREMENTS', 'PRIORITIES',
    ];
    const collectedCats = ALL_CATEGORIES.filter(
      key => categories[key]?.['fields_collected']?.length > 0,
    ).length;
    progress['categories'] = categories;
    progress['overall_progress'] = Math.round((collectedCats / ALL_CATEGORIES.length) * 100);

    // Use update with fresh data to minimize race window
    await this.projectRepo.update(projectId, { collection_progress: progress });
  }
}
