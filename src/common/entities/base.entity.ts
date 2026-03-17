import {
  PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

/** Base entity with UUID PK and timestamps — all entities extend this */
export abstract class BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;
}

/** Base entity with update tracking */
export abstract class BaseEntityWithUpdate extends BaseEntity {
  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;
}
