import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { Message } from '../entities/message.entity';
import { SenderType } from '../common/enums';
import { SYSTEM_PROMPT } from './prompts/system-prompt';

@Injectable()
export class PromptService {
  private readonly logger = new Logger(PromptService.name);

  buildSystemPrompt(projectName: string, progress?: Record<string, any>): string {
    let contextBlock = `\n\n## THÔNG TIN DỰ ÁN HIỆN TẠI\nTên dự án: ${projectName}\n`;

    if (progress && Object.keys(progress).length > 0) {
      const overallProgress = progress['overall_progress'] ?? 0;
      contextBlock += `Tiến độ thu thập: ${overallProgress}%\n`;

      const categories = progress['categories'] ?? progress;
      const incomplete: string[] = [];

      for (const [key, val] of Object.entries(categories)) {
        if (typeof val === 'object' && val !== null) {
          const catData = val as Record<string, any>;
          if (catData['status'] !== 'completed') {
            incomplete.push(key);
          }
        }
      }

      if (incomplete.length > 0) {
        contextBlock += `Chưa thu thập: ${incomplete.join(', ')}\n`;
      }
    }

    this.logger.debug(`Built system prompt for project: ${projectName}`);
    return SYSTEM_PROMPT + contextBlock;
  }

  buildMessages(
    systemPrompt: string,
    history: Message[],
    userMessage: string,
  ): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
    ];

    for (const msg of history) {
      if (msg.sender_type === SenderType.USER) {
        messages.push({ role: 'user', content: msg.content });
      } else if (msg.sender_type === SenderType.AI) {
        messages.push({ role: 'assistant', content: msg.content });
      }
    }

    messages.push({ role: 'user', content: userMessage });
    return messages;
  }
}
