import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseService } from '../common/services/base.service';
import { Conversation } from '../entities/conversation.entity';
import { Message } from '../entities/message.entity';
import { CollectionData } from '../entities/collection-data.entity';
import { SenderType } from '../common/enums';

@Injectable()
export class ChatService extends BaseService<Conversation> {
  protected readonly logger = new Logger(ChatService.name);

  constructor(
    @InjectRepository(Conversation)
    private readonly conversationRepo: Repository<Conversation>,
    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>,
    @InjectRepository(CollectionData)
    private readonly collectionDataRepo: Repository<CollectionData>,
  ) {
    super(conversationRepo);
  }

  async findByProject(projectId: string): Promise<Conversation[]> {
    this.logger.log(`findByProject: projectId=${projectId}`);
    return this.conversationRepo.find({
      where: { project_id: projectId },
      order: { created_at: 'DESC' },
    });
  }

  async getMessages(
    conversationId: string,
    page: number,
    limit: number,
  ): Promise<{ data: Message[]; total: number; page: number; limit: number }> {
    const skip = (page - 1) * limit;
    const [data, total] = await this.messageRepo.findAndCount({
      where: { conversation_id: conversationId },
      order: { created_at: 'ASC' },
      skip,
      take: limit,
    });

    this.logger.log(`getMessages: conversationId=${conversationId} total=${total}`);
    return { data, total, page, limit };
  }

  async saveMessage(
    conversationId: string,
    senderType: SenderType,
    content: string,
    senderId?: string,
    metadata?: Record<string, any>,
  ): Promise<Message> {
    const message = this.messageRepo.create({
      conversation_id: conversationId,
      sender_type: senderType,
      content,
      sender_id: senderId,
      metadata: metadata ?? {},
    });

    const saved = await this.messageRepo.save(message) as Message;

    // Increment total_messages and update last_message_at
    await this.conversationRepo
      .createQueryBuilder()
      .update(Conversation)
      .set({
        total_messages: () => 'total_messages + 1',
        last_message_at: new Date(),
      })
      .where('id = :id', { id: conversationId })
      .execute();

    this.logger.log(`saveMessage: conversationId=${conversationId} sender=${senderType} id=${saved.id}`);
    return saved;
  }

  async getCollectionData(conversationId: string): Promise<CollectionData[]> {
    this.logger.log(`getCollectionData: conversationId=${conversationId}`);
    return this.collectionDataRepo.find({
      where: { conversation_id: conversationId },
      order: { category: 'ASC' },
    });
  }

  async getRecentMessages(conversationId: string, limit = 50): Promise<Message[]> {
    return this.messageRepo.find({
      where: { conversation_id: conversationId },
      order: { created_at: 'ASC' },
      take: limit,
    });
  }
}
