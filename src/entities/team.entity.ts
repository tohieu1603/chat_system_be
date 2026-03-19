import { Entity, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { BaseEntityWithUpdate } from '../common/entities/base.entity';
import { User } from './user.entity';
import { Batch } from './batch.entity';
import { TeamMember } from './team-member.entity';

@Entity('teams')
export class Team extends BaseEntityWithUpdate {
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  /** 8-char random invite code */
  @Column({ type: 'varchar', length: 8, unique: true })
  invite_code: string;

  @Column({ type: 'integer', default: 3 })
  max_members: number;

  @Column({ type: 'uuid' })
  batch_id: string;

  @ManyToOne(() => Batch, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'batch_id' })
  batch: Batch;

  @Column({ type: 'uuid' })
  created_by: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'created_by' })
  creator: User;

  @OneToMany(() => TeamMember, (tm) => tm.team)
  members: TeamMember[];
}
