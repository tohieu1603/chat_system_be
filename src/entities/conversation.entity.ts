import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntityWithUpdate } from '../common/entities/base.entity';
import { Project } from './project.entity';
import { ConversationType, ConversationStatus } from '../common/enums';

@Entity('conversations')
export class Conversation extends BaseEntityWithUpdate {
  @Column({ type: 'uuid' })
  project_id: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @Column({ type: 'varchar', length: 255, nullable: true })
  title: string;

  @Column({ type: 'enum', enum: ConversationType, default: ConversationType.AI_COLLECT })
  conversation_type: ConversationType;

  @Column({ type: 'enum', enum: ConversationStatus, default: ConversationStatus.ACTIVE })
  status: ConversationStatus;

  @Column({ type: 'int', default: 0 })
  total_messages: number;

  @Column({ type: 'int', default: 0 })
  total_tokens: number;

  @Column({ type: 'timestamp', nullable: true })
  last_message_at: Date;

  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, any>;
}
