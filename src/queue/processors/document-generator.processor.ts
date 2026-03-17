import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { Project } from '../../entities/project.entity';
import { CollectionData } from '../../entities/collection-data.entity';
import { StorageService } from '../../storage/storage.service';

@Processor('document-generation')
export class DocumentGeneratorProcessor extends WorkerHost {
  private readonly logger = new Logger(DocumentGeneratorProcessor.name);
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @InjectRepository(CollectionData)
    private readonly collectionRepo: Repository<CollectionData>,
    private readonly storageService: StorageService,
    private readonly config: ConfigService,
  ) {
    super();
    const apiKey = config.get<string>('BYTEPLUS_API_KEY') ?? '';
    const baseURL =
      config.get<string>('BYTEPLUS_API_URL') ??
      'https://ark.ap-southeast.bytepluses.com/api/coding/v3';
    this.model = config.get<string>('AI_MODEL') ?? 'bytedance/doubao-1.5-pro-256k';
    this.client = new OpenAI({ apiKey, baseURL });
  }

  async process(job: Job<{ projectId: string }>): Promise<void> {
    const { projectId } = job.data;
    this.logger.log(`process: jobId=${job.id}, projectId=${projectId}`);

    const project = await this.projectRepo.findOne({ where: { id: projectId } });
    if (!project) {
      this.logger.warn(`process: project not found id=${projectId}`);
      return;
    }

    const collectionData = await this.collectionRepo.find({
      where: { project_id: projectId },
    });

    this.logger.log(`process: loaded ${collectionData.length} collection items`);

    const dataContext = collectionData.map((cd) => ({
      category: cd.category,
      key: cd.data_key,
      value: cd.data_value,
      confidence: cd.confidence,
    }));

    const prompt = `You are a senior software architect. Based on the following collected project data, generate a comprehensive software requirements document in JSON format.

Project Name: ${project.project_name}
Project Code: ${project.project_code}
Description: ${project.description ?? 'N/A'}

Collected Data:
${JSON.stringify(dataContext, null, 2)}

Generate a structured requirements document JSON with these sections:
{
  "project_overview": { "name": "", "description": "", "objectives": [], "scope": "" },
  "stakeholders": [{ "role": "", "responsibilities": [] }],
  "functional_requirements": [{ "id": "", "title": "", "description": "", "priority": "" }],
  "non_functional_requirements": [{ "category": "", "description": "", "metrics": "" }],
  "technical_architecture": { "frontend": "", "backend": "", "database": "", "infrastructure": "" },
  "data_models": [{ "entity": "", "fields": [], "relationships": [] }],
  "api_endpoints": [{ "method": "", "path": "", "description": "" }],
  "ui_screens": [{ "name": "", "description": "", "components": [] }],
  "integrations": [{ "service": "", "purpose": "" }],
  "timeline": { "phases": [{ "name": "", "duration": "", "deliverables": [] }] },
  "budget_estimate": { "total": "", "breakdown": [] },
  "risks": [{ "risk": "", "mitigation": "" }]
}

Return ONLY valid JSON.`;

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.4,
      max_tokens: 8192,
    });

    const jsonStr = response.choices[0]?.message?.content ?? '{}';
    let requirementJson: Record<string, any>;

    try {
      requirementJson = JSON.parse(jsonStr);
    } catch {
      this.logger.error('process: failed to parse AI JSON response');
      requirementJson = { raw: jsonStr };
    }

    const markdown = this.renderMarkdown(requirementJson, project.project_name);
    const mdBuffer = Buffer.from(markdown, 'utf-8');
    const key = `requirements/${projectId}/requirement-doc.md`;

    await this.storageService.uploadFile(key, mdBuffer, 'text/markdown');
    const docUrl = this.storageService.getFileUrl(key);

    await this.projectRepo.save({
      ...project,
      requirement_json: requirementJson,
      requirement_doc_url: docUrl,
    });

    this.logger.log(`process: completed for projectId=${projectId}, url=${docUrl}`);
  }

  private renderMarkdown(json: Record<string, any>, projectName: string): string {
    const lines: string[] = [];

    lines.push(`# Software Requirements Document`);
    lines.push(`## Project: ${projectName}`);
    lines.push(`*Generated on ${new Date().toISOString().split('T')[0]}*`);
    lines.push('');

    const overview = json['project_overview'];
    if (overview) {
      lines.push('## 1. Project Overview');
      if (overview.name) lines.push(`**Name:** ${overview.name}`);
      if (overview.description) lines.push(`**Description:** ${overview.description}`);
      if (overview.scope) lines.push(`**Scope:** ${overview.scope}`);
      if (Array.isArray(overview.objectives) && overview.objectives.length) {
        lines.push('**Objectives:**');
        overview.objectives.forEach((o: string) => lines.push(`- ${o}`));
      }
      lines.push('');
    }

    const stakeholders = json['stakeholders'];
    if (Array.isArray(stakeholders) && stakeholders.length) {
      lines.push('## 2. Stakeholders');
      stakeholders.forEach((s: any) => {
        lines.push(`### ${s.role ?? 'Unknown Role'}`);
        if (Array.isArray(s.responsibilities)) {
          s.responsibilities.forEach((r: string) => lines.push(`- ${r}`));
        }
      });
      lines.push('');
    }

    const funcReqs = json['functional_requirements'];
    if (Array.isArray(funcReqs) && funcReqs.length) {
      lines.push('## 3. Functional Requirements');
      funcReqs.forEach((req: any) => {
        lines.push(`### ${req.id ?? ''} ${req.title ?? ''}`);
        if (req.description) lines.push(req.description);
        if (req.priority) lines.push(`**Priority:** ${req.priority}`);
        lines.push('');
      });
    }

    const nonFuncReqs = json['non_functional_requirements'];
    if (Array.isArray(nonFuncReqs) && nonFuncReqs.length) {
      lines.push('## 4. Non-Functional Requirements');
      nonFuncReqs.forEach((req: any) => {
        lines.push(`### ${req.category ?? 'General'}`);
        if (req.description) lines.push(req.description);
        if (req.metrics) lines.push(`**Metrics:** ${req.metrics}`);
        lines.push('');
      });
    }

    const arch = json['technical_architecture'];
    if (arch) {
      lines.push('## 5. Technical Architecture');
      if (arch.frontend) lines.push(`- **Frontend:** ${arch.frontend}`);
      if (arch.backend) lines.push(`- **Backend:** ${arch.backend}`);
      if (arch.database) lines.push(`- **Database:** ${arch.database}`);
      if (arch.infrastructure) lines.push(`- **Infrastructure:** ${arch.infrastructure}`);
      lines.push('');
    }

    const dataModels = json['data_models'];
    if (Array.isArray(dataModels) && dataModels.length) {
      lines.push('## 6. Data Models');
      dataModels.forEach((m: any) => {
        lines.push(`### ${m.entity ?? 'Entity'}`);
        if (Array.isArray(m.fields) && m.fields.length) {
          lines.push('**Fields:** ' + m.fields.join(', '));
        }
        if (Array.isArray(m.relationships) && m.relationships.length) {
          lines.push('**Relationships:** ' + m.relationships.join(', '));
        }
        lines.push('');
      });
    }

    const apis = json['api_endpoints'];
    if (Array.isArray(apis) && apis.length) {
      lines.push('## 7. API Endpoints');
      apis.forEach((api: any) => {
        lines.push(`- \`${api.method ?? 'GET'} ${api.path ?? ''}\` — ${api.description ?? ''}`);
      });
      lines.push('');
    }

    const screens = json['ui_screens'];
    if (Array.isArray(screens) && screens.length) {
      lines.push('## 8. UI Screens');
      screens.forEach((s: any) => {
        lines.push(`### ${s.name ?? 'Screen'}`);
        if (s.description) lines.push(s.description);
        if (Array.isArray(s.components) && s.components.length) {
          lines.push('**Components:** ' + s.components.join(', '));
        }
        lines.push('');
      });
    }

    const integrations = json['integrations'];
    if (Array.isArray(integrations) && integrations.length) {
      lines.push('## 9. Integrations');
      integrations.forEach((i: any) => {
        lines.push(`- **${i.service ?? ''}**: ${i.purpose ?? ''}`);
      });
      lines.push('');
    }

    const timeline = json['timeline'];
    if (timeline?.phases && Array.isArray(timeline.phases)) {
      lines.push('## 10. Timeline');
      timeline.phases.forEach((p: any, idx: number) => {
        lines.push(`### Phase ${idx + 1}: ${p.name ?? ''} (${p.duration ?? ''})`);
        if (Array.isArray(p.deliverables)) {
          p.deliverables.forEach((d: string) => lines.push(`- ${d}`));
        }
        lines.push('');
      });
    }

    const budget = json['budget_estimate'];
    if (budget) {
      lines.push('## 11. Budget Estimate');
      if (budget.total) lines.push(`**Total:** ${budget.total}`);
      if (Array.isArray(budget.breakdown)) {
        budget.breakdown.forEach((b: any) => {
          lines.push(`- ${typeof b === 'string' ? b : JSON.stringify(b)}`);
        });
      }
      lines.push('');
    }

    const risks = json['risks'];
    if (Array.isArray(risks) && risks.length) {
      lines.push('## 12. Risks & Mitigations');
      risks.forEach((r: any) => {
        lines.push(`- **Risk:** ${r.risk ?? ''}`);
        if (r.mitigation) lines.push(`  **Mitigation:** ${r.mitigation}`);
      });
      lines.push('');
    }

    return lines.join('\n');
  }
}
