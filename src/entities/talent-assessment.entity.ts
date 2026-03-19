import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntityWithUpdate } from '../common/entities/base.entity';
import { PotentialRole } from '../common/enums';
import { User } from './user.entity';
import { Batch } from './batch.entity';

@Entity('talent_assessments')
export class TalentAssessment extends BaseEntityWithUpdate {
  @Column({ type: 'uuid' })
  user_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'uuid' })
  evaluator_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'evaluator_id' })
  evaluator: User;

  @Column({ type: 'uuid', nullable: true })
  batch_id: string;

  @ManyToOne(() => Batch, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'batch_id' })
  batch: Batch;

  /* 6 tiêu chí đánh giá năng lực (1-10) */
  @Column({ type: 'integer', nullable: true })
  business_thinking: number;

  @Column({ type: 'integer', nullable: true })
  marketing_ability: number;

  @Column({ type: 'integer', nullable: true })
  proactiveness: number;

  @Column({ type: 'integer', nullable: true })
  teamwork: number;

  @Column({ type: 'integer', nullable: true })
  learning_speed: number;

  @Column({ type: 'integer', nullable: true })
  resilience: number;

  /* Nhận xét */
  @Column({ type: 'text', nullable: true })
  comments: string;

  @Column({ type: 'enum', enum: PotentialRole, nullable: true })
  potential_role: PotentialRole;

  @Column({ type: 'text', nullable: true })
  training_notes: string;
}
