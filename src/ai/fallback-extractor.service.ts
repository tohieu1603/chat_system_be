import { Injectable, Logger } from '@nestjs/common';
import { ToolHandlerService } from './tool-handler.service';

/**
 * Fallback data extraction when AI model doesn't call tools.
 * Analyzes user message keywords and saves data automatically.
 */
@Injectable()
export class FallbackExtractorService {
  private readonly logger = new Logger(FallbackExtractorService.name);

  constructor(private readonly toolHandler: ToolHandlerService) {}

  /**
   * Analyze user message and extract data into appropriate categories.
   * Returns true if any data was extracted and saved.
   */
  async extractAndSave(
    userMessage: string,
    projectId: string,
    conversationId: string,
    messageId?: string,
  ): Promise<boolean> {
    const msg = userMessage.toLowerCase();
    const toolCalls: Array<{ name: string; args: Record<string, any> }> = [];

    // Company info keywords
    if (this.matchAny(msg, ['công ty', 'ngành', 'nhân viên', 'quy mô', 'doanh nghiệp', 'lĩnh vực'])) {
      const args: Record<string, any> = {};
      // Extract company name (after "công ty" keyword)
      const companyMatch = userMessage.match(/[Cc]ông ty\s+([^,.\n]+)/);
      if (companyMatch) args.company_name = companyMatch[1].trim();
      // Extract industry
      const industryMatch = userMessage.match(/ngành\s+([^,.\n]+)/i);
      if (industryMatch) args.industry = industryMatch[1].trim();
      // Extract size
      const sizeMatch = userMessage.match(/(\d+)\s*(?:nhân viên|người|nv)/i);
      if (sizeMatch) args.company_size = sizeMatch[1] + ' nhân viên';
      // Extract pain points (after "lộn xộn", "khó khăn", etc.)
      const painWords = ['lộn xộn', 'khó khăn', 'vấn đề', 'thủ công', 'chậm', 'excel'];
      const hasPain = painWords.some((w) => msg.includes(w));
      if (hasPain) args.pain_points = [userMessage.substring(0, 200)];

      if (Object.keys(args).length > 0) {
        toolCalls.push({ name: 'save_company_info', args });
      }
    }

    // Department keywords
    if (this.matchAny(msg, ['phòng ban', 'phòng', 'ban giám đốc', 'kỹ thuật', 'kinh doanh', 'kế toán', 'nhân sự'])) {
      const deptPattern = /(?:phòng\s+)?(\w+[\w\s]*?)\s*\(\s*(\d+)\s*(?:người|nv)\s*\)/gi;
      const departments: Array<{ name: string; head_count: number }> = [];
      let match;
      while ((match = deptPattern.exec(userMessage)) !== null) {
        departments.push({ name: match[1].trim(), head_count: parseInt(match[2]) });
      }
      if (departments.length > 0) {
        toolCalls.push({ name: 'save_department_info', args: { departments } });
      }
    }

    // Workflow keywords
    if (this.matchAny(msg, ['quy trình', 'luồng', 'workflow', '→', '->', 'chuyển', 'phê duyệt'])) {
      const args: Record<string, any> = {
        workflow_name: 'Quy trình chính',
        description: userMessage.substring(0, 500),
      };
      toolCalls.push({ name: 'save_workflow_info', args });
    }

    // Salary keywords
    if (this.matchAny(msg, ['lương', 'chấm công', 'phụ cấp', 'thưởng', 'kpi', 'trả lương'])) {
      const args: Record<string, any> = {};
      const payMatch = userMessage.match(/(?:trả lương|lương)\s*(?:ngày|vào)\s*(\d+)/i);
      if (payMatch) args.pay_cycle = `Ngày ${payMatch[1]} hàng tháng`;
      if (msg.includes('cơ bản')) args.salary_structure = 'Lương cơ bản + phụ cấp + thưởng';
      const components: string[] = [];
      if (msg.includes('cơ bản')) components.push('Lương cơ bản');
      if (msg.includes('phụ cấp')) components.push('Phụ cấp');
      if (msg.includes('thưởng') || msg.includes('kpi')) components.push('Thưởng KPI');
      if (components.length > 0) args.components = components.map((c) => ({ name: c }));
      if (Object.keys(args).length > 0) {
        toolCalls.push({ name: 'save_salary_info', args });
      }
    }

    // Scheduling keywords
    if (this.matchAny(msg, ['ca làm', 'ca sáng', 'ca chiều', 'ca tối', 'giờ làm', 'lịch làm'])) {
      const shifts: string[] = [];
      if (msg.includes('sáng')) shifts.push('Ca sáng');
      if (msg.includes('chiều')) shifts.push('Ca chiều');
      if (msg.includes('tối')) shifts.push('Ca tối');
      toolCalls.push({
        name: 'save_scheduling_info',
        args: { shift_types: shifts.length > 0 ? shifts : ['Ca hành chính'], work_schedule: userMessage.substring(0, 200) },
      });
    }

    // Feature keywords
    if (this.matchAny(msg, ['tính năng', 'cần', 'muốn', 'quản lý', 'báo cáo', 'chức năng'])) {
      // Extract numbered list items
      const featurePattern = /\d+\)\s*([^,\d)]+)/g;
      let fMatch;
      while ((fMatch = featurePattern.exec(userMessage)) !== null) {
        toolCalls.push({
          name: 'save_feature_request',
          args: { feature_name: fMatch[1].trim(), description: fMatch[1].trim(), priority: 'MEDIUM' },
        });
      }
    }

    // Special requirements
    if (this.matchAny(msg, ['tích hợp', 'đặc biệt', 'zkkteco', 'thuế', 'pháp lý', 'bảo mật'])) {
      toolCalls.push({
        name: 'save_special_requirements',
        args: { requirement: userMessage.substring(0, 300), category: 'integration' },
      });
    }

    // Execute extracted tool calls
    if (toolCalls.length === 0) return false;

    this.logger.log(`Fallback extraction: ${toolCalls.length} tool calls from user message`);

    for (const tc of toolCalls) {
      try {
        await this.toolHandler.handleToolCalls(
          [{ id: `fb_${Date.now()}`, index: 0, function: { name: tc.name, arguments: JSON.stringify(tc.args) } } as any],
          projectId,
          conversationId,
          messageId,
        );
      } catch (err) {
        this.logger.warn(`Fallback tool ${tc.name} failed: ${(err as Error).message}`);
      }
    }

    return true;
  }

  private matchAny(text: string, keywords: string[]): boolean {
    return keywords.some((kw) => text.includes(kw));
  }
}
