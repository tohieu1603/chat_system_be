import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { Conversation } from './conversation.entity';
import { User } from './user.entity';
import { SenderType, MessageType } from '../common/enums';

@Entity('messages')
export class Message extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  conversation_id: string;

  @ManyToOne(() => Conversation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversation_id' })
  conversation: Conversation;

  @Column({ type: 'enum', enum: SenderType })
  sender_type: SenderType;

  @Column({ type: 'uuid', nullable: true })
  sender_id: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'sender_id' })
  sender: User;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'enum', enum: MessageType, default: MessageType.TEXT })
  message_type: MessageType;

  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, any>;

  @Column({ type: 'boolean', default: false })
  is_read: boolean;
}
