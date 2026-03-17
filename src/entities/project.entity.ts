import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntityWithUpdate } from '../common/entities/base.entity';
import { User } from './user.entity';
import { ProjectStatus, Priority } from '../common/enums';

@Entity('projects')
export class Project extends BaseEntityWithUpdate {
  @Column({ type: 'uuid' })
  customer_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customer_id' })
  customer: User;

  @Column({ type: 'varchar', length: 255 })
  project_name: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  project_code: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'enum', enum: ProjectStatus, default: ProjectStatus.COLLECTING })
  status: ProjectStatus;

  @Column({ type: 'jsonb', default: {} })
  collection_progress: Record<string, any>;

  @Column({ type: 'text', nullable: true })
  requirement_doc_url: string;

  @Column({ type: 'jsonb', nullable: true })
  requirement_json: Record<string, any>;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  estimated_budget: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  actual_budget: number;

  @Column({ type: 'date', nullable: true })
  estimated_deadline: Date;

  @Column({ type: 'enum', enum: Priority, default: Priority.MEDIUM })
  priority: Priority;
}
