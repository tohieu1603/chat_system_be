import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntityWithUpdate } from '../common/entities/base.entity';
import { EvaluationRecommendation } from '../common/enums';
import { BusinessPlan } from './business-plan.entity';
import { User } from './user.entity';

@Entity('evaluations')
export class Evaluation extends BaseEntityWithUpdate {
  @Column({ type: 'uuid' })
  plan_id: string;

  @ManyToOne(() => BusinessPlan, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'plan_id' })
  plan: BusinessPlan;

  @Column({ type: 'uuid' })
  evaluator_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'evaluator_id' })
  evaluator: User;

  /* 4 tiêu chí chấm điểm (1-10) */
  @Column({ type: 'integer', nullable: true })
  workflow_score: number;

  @Column({ type: 'integer', nullable: true })
  business_score: number;

  @Column({ type: 'integer', nullable: true })
  organic_score: number;

  @Column({ type: 'integer', nullable: true })
  ads_score: number;

  /** Điểm tổng theo trọng số — computed in service layer */
  @Column({ type: 'decimal', precision: 4, scale: 2, nullable: true })
  weighted_total: number;

  /* Nhận xét */
  @Column({ type: 'text', nullable: true })
  strengths: string;

  @Column({ type: 'text', nullable: true })
  weaknesses: string;

  @Column({ type: 'text', nullable: true })
  improvement_notes: string;

  @Column({ type: 'enum', enum: EvaluationRecommendation, nullable: true })
  recommendation: EvaluationRecommendation;
}
