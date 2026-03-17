import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntityWithUpdate } from '../common/entities/base.entity';
import { Conversation } from './conversation.entity';
import { Project } from './project.entity';
import { Message } from './message.entity';
import { CollectionCategory } from '../common/enums';

@Entity('collection_data')
export class CollectionData extends BaseEntityWithUpdate {
  @Column({ type: 'uuid' })
  conversation_id: string;

  @ManyToOne(() => Conversation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversation_id' })
  conversation: Conversation;

  @Column({ type: 'uuid' })
  project_id: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @Column({ type: 'enum', enum: CollectionCategory })
  category: CollectionCategory;

  @Column({ type: 'varchar', length: 100 })
  data_key: string;

  @Column({ type: 'jsonb' })
  data_value: Record<string, any>;

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 1.0 })
  confidence: number;

  @Column({ type: 'uuid', nullable: true })
  source_message_id: string;

  @ManyToOne(() => Message, { nullable: true })
  @JoinColumn({ name: 'source_message_id' })
  source_message: Message;

  @Column({ type: 'boolean', default: false })
  is_confirmed: boolean;
}
