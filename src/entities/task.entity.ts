import { Entity, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { BaseEntityWithUpdate } from '../common/entities/base.entity';
import { Project } from './project.entity';
import { User } from './user.entity';
import { TaskStatus, TaskType, Priority } from '../common/enums';

@Entity('tasks')
export class Task extends BaseEntityWithUpdate {
  @Column({ type: 'uuid' })
  project_id: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @Column({ type: 'uuid', nullable: true })
  parent_task_id: string;

  @ManyToOne(() => Task, (t) => t.children, { nullable: true })
  @JoinColumn({ name: 'parent_task_id' })
  parent: Task;

  @OneToMany(() => Task, (t) => t.parent)
  children: Task[];

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'enum', enum: TaskType, nullable: true })
  task_type: TaskType;

  @Column({ type: 'enum', enum: TaskStatus, default: TaskStatus.TODO })
  status: TaskStatus;

  @Column({ type: 'enum', enum: Priority, default: Priority.MEDIUM })
  priority: Priority;

  @Column({ type: 'uuid', nullable: true })
  assignee_id: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'assignee_id' })
  assignee: User;

  @Column({ type: 'decimal', precision: 6, scale: 1, nullable: true })
  estimated_hours: number;

  @Column({ type: 'decimal', precision: 6, scale: 1, nullable: true })
  actual_hours: number;

  @Column({ type: 'date', nullable: true })
  due_date: Date;

  @Column({ type: 'int', default: 0 })
  sort_order: number;

  @Column({ type: 'text', array: true, nullable: true })
  tags: string[];
}
