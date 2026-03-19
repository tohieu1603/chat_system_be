import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntityWithUpdate } from '../common/entities/base.entity';
import { PlanStatus } from '../common/enums';
import { Team } from './team.entity';
import { Batch } from './batch.entity';

@Entity('business_plans')
export class BusinessPlan extends BaseEntityWithUpdate {
  @Column({ type: 'uuid' })
  team_id: string;

  @ManyToOne(() => Team, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'team_id' })
  team: Team;

  @Column({ type: 'uuid', nullable: true })
  batch_id: string;

  @ManyToOne(() => Batch, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'batch_id' })
  batch: Batch;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'enum', enum: PlanStatus, default: PlanStatus.DRAFT })
  status: PlanStatus;

  /* PHẦN 1: Tổng quan dự án */
  @Column({ type: 'text', nullable: true })
  executive_summary: string;

  @Column({ type: 'text', nullable: true })
  problem_statement: string;

  @Column({ type: 'text', nullable: true })
  solution: string;

  /* PHẦN 2: Thị trường & Khách hàng */
  @Column({ type: 'text', nullable: true })
  target_market: string;

  @Column({ type: 'text', nullable: true })
  customer_persona: string;

  @Column({ type: 'text', nullable: true })
  competitive_analysis: string;

  /* PHẦN 3: Chiến lược tăng trưởng */
  @Column({ type: 'text', nullable: true })
  organic_marketing: string;

  @Column({ type: 'text', nullable: true })
  paid_advertising: string;

  /* PHẦN 4: Vận hành & Công nghệ */
  @Column({ type: 'text', nullable: true })
  operation_workflow: string;

  @Column({ type: 'text', nullable: true })
  payment_system: string;

  @Column({ type: 'text', nullable: true })
  tech_requirements: string;

  /* PHẦN 5: Tài chính */
  @Column({ type: 'text', nullable: true })
  cost_structure: string;

  @Column({ type: 'text', nullable: true })
  revenue_model: string;

  @Column({ type: 'jsonb', nullable: true })
  milestones: Record<string, any>[];

  @Column({ type: 'text', array: true, nullable: true })
  attachments: string[];

  @Column({ type: 'timestamp', nullable: true })
  submitted_at: Date;
}
