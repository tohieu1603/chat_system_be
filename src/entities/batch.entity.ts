import { Entity, Column } from 'typeorm';
import { BaseEntityWithUpdate } from '../common/entities/base.entity';
import { BatchStatus } from '../common/enums';

@Entity('batches')
export class Batch extends BaseEntityWithUpdate {
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'enum', enum: BatchStatus, default: BatchStatus.UPCOMING })
  status: BatchStatus;

  @Column({ type: 'integer', default: 10 })
  max_teams: number;

  @Column({ type: 'timestamp', nullable: true })
  application_start: Date;

  @Column({ type: 'timestamp', nullable: true })
  application_end: Date;
}
