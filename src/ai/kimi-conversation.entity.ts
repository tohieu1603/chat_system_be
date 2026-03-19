import { Entity, Column, Index } from 'typeorm';
import { BaseEntityWithUpdate } from '../common/entities/base.entity';

/** Kimi AI chat conversations — scoped to candidate users */
@Entity('kimi_conversations')
export class KimiConversation extends BaseEntityWithUpdate {
  @Index()
  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  title: string;

  /** Optional link to a business plan */
  @Column({ type: 'uuid', nullable: true })
  plan_id: string;

  @Column({ type: 'int', default: 0 })
  total_messages: number;

  @Column({ type: 'timestamp', nullable: true })
  last_message_at: Date;
}
