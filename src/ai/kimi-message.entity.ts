import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';

export type KimiSenderType = 'USER' | 'ASSISTANT';

/** Messages in a Kimi AI conversation */
@Entity('kimi_messages')
export class KimiMessage extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  conversation_id: string;

  @Column({ type: 'varchar', length: 20 })
  sender_type: KimiSenderType;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, any>;
}
