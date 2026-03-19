import {
  Injectable,
  Logger,
  NotFoundException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Response } from 'express';
import { AiService } from './ai.service';
import { KimiConversation } from './kimi-conversation.entity';
import { KimiMessage } from './kimi-message.entity';
import { KIMI_SYSTEM_PROMPT, getAskKimiPrompt } from './kimi-system-prompt';

const DAILY_RATE_LIMIT = 50;

@Injectable()
export class KimiChatService {
  private readonly logger = new Logger(KimiChatService.name);

  constructor(
    private readonly aiService: AiService,
    @InjectRepository(KimiConversation)
    private readonly convRepo: Repository<KimiConversation>,
    @InjectRepository(KimiMessage)
    private readonly msgRepo: Repository<KimiMessage>,
  ) {}

  /** Create a new Kimi conversation for a user */
  async createConversation(userId: string, planId?: string): Promise<KimiConversation> {
    this.logger.log(`createConversation: userId=${userId} planId=${planId}`);
    const conv = this.convRepo.create({
      user_id: userId,
      plan_id: planId ?? undefined,
      title: 'Trò chuyện mới',
    });
    return this.convRepo.save(conv);
  }

  /** List all Kimi conversations for a user */
  async getConversations(userId: string): Promise<KimiConversation[]> {
    return this.convRepo.find({
      where: { user_id: userId },
      order: { last_message_at: 'DESC', created_at: 'DESC' },
    });
  }

  /** Get paginated messages for a conversation */
  async getMessages(
    conversationId: string,
    userId: string,
    page = 1,
    limit = 50,
  ): Promise<{ data: KimiMessage[]; total: number; page: number; limit: number }> {
    await this.assertOwnership(conversationId, userId);
    const skip = (page - 1) * limit;
    const [data, total] = await this.msgRepo.findAndCount({
      where: { conversation_id: conversationId },
      order: { created_at: 'ASC' },
      skip,
      take: limit,
    });
    return { data, total, page, limit };
  }

  /** Send a message and stream the AI response via SSE */
  async sendMessage(
    conversationId: string,
    userId: string,
    content: string,
    res: Response,
    sectionContext?: { sectionName: string; currentContent: string },
  ): Promise<void> {
    await this.assertOwnership(conversationId, userId);
    await this.checkRateLimit(userId);

    // Save user message
    await this.saveMessage(conversationId, 'USER', content);
    await this.updateConversation(conversationId, content);

    // Determine system prompt
    const systemPrompt = sectionContext
      ? getAskKimiPrompt(sectionContext.sectionName, sectionContext.currentContent)
      : KIMI_SYSTEM_PROMPT;

    // Build message history (last 20 messages for context window)
    const history = await this.msgRepo.find({
      where: { conversation_id: conversationId },
      order: { created_at: 'ASC' },
      take: 20,
    });

    const aiMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
      ...history.map((m) => ({
        role: m.sender_type === 'USER' ? ('user' as const) : ('assistant' as const),
        content: m.content,
      })),
    ];

    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    let fullResponse = '';

    try {
      const stream = this.aiService.chat(aiMessages, false);

      for await (const chunk of stream) {
        if (chunk.content) {
          fullResponse += chunk.content;
          res.write(`data: ${JSON.stringify({ content: chunk.content, done: false })}\n\n`);
        }
        if (chunk.isDone) {
          break;
        }
      }

      // Save assistant message
      await this.saveMessage(conversationId, 'ASSISTANT', fullResponse);
      await this.updateConversation(conversationId, fullResponse);

      // Auto-update conversation title from first user message
      const conv = await this.convRepo.findOne({ where: { id: conversationId } });
      if (conv && conv.total_messages <= 2 && conv.title === 'Trò chuyện mới') {
        const shortTitle = content.slice(0, 60).trim();
        await this.convRepo.update(conversationId, { title: shortTitle });
      }

      res.write(`data: ${JSON.stringify({ content: '', done: true })}\n\n`);
    } catch (err) {
      this.logger.error(`sendMessage stream error: ${err}`);
      res.write(`data: ${JSON.stringify({ error: 'Đã xảy ra lỗi, vui lòng thử lại.', done: true })}\n\n`);
    } finally {
      res.end();
    }
  }

  /** Ask Kimi about a specific plan section — creates or reuses plan-linked conversation */
  async askSection(
    userId: string,
    planId: string,
    sectionName: string,
    currentContent: string,
    question: string,
    res: Response,
  ): Promise<void> {
    // Find or create a plan-linked conversation
    let conv = await this.convRepo.findOne({
      where: { user_id: userId, plan_id: planId },
      order: { created_at: 'DESC' },
    });

    if (!conv) {
      conv = await this.createConversation(userId, planId);
    }

    await this.sendMessage(conv.id, userId, question, res, { sectionName, currentContent });
  }

  // ──────────────── Private helpers ────────────────

  private async assertOwnership(conversationId: string, userId: string): Promise<KimiConversation> {
    const conv = await this.convRepo.findOne({ where: { id: conversationId, user_id: userId } });
    if (!conv) throw new NotFoundException('Cuộc trò chuyện không tồn tại');
    return conv;
  }

  private async checkRateLimit(userId: string): Promise<void> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    // Count user messages sent today across all their conversations
    const convIds = (await this.convRepo.find({ where: { user_id: userId }, select: ['id'] })).map(
      (c) => c.id,
    );

    if (convIds.length === 0) return;

    const count = await this.msgRepo
      .createQueryBuilder('m')
      .where('m.conversation_id IN (:...ids)', { ids: convIds })
      .andWhere("m.sender_type = 'USER'")
      .andWhere('m.created_at >= :start', { start: startOfDay })
      .getCount();

    if (count >= DAILY_RATE_LIMIT) {
      throw new HttpException(
        'Bạn đã đạt giới hạn 50 tin nhắn/ngày. Vui lòng quay lại vào ngày mai.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async saveMessage(
    conversationId: string,
    senderType: 'USER' | 'ASSISTANT',
    content: string,
  ): Promise<KimiMessage> {
    const msg = this.msgRepo.create({ conversation_id: conversationId, sender_type: senderType, content });
    return this.msgRepo.save(msg);
  }

  private async updateConversation(conversationId: string, _lastContent: string): Promise<void> {
    await this.convRepo
      .createQueryBuilder()
      .update(KimiConversation)
      .set({ total_messages: () => 'total_messages + 1', last_message_at: new Date() })
      .where('id = :id', { id: conversationId })
      .execute();
  }
}
