import { Entity, Column } from 'typeorm';
import { BaseEntityWithUpdate } from '../common/entities/base.entity';
import { Role } from '../common/enums';

@Entity('users')
export class User extends BaseEntityWithUpdate {
  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 255, select: false })
  password_hash: string;

  @Column({ type: 'varchar', length: 255 })
  full_name: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  avatar_url: string;

  @Column({ type: 'enum', enum: Role, default: Role.CUSTOMER })
  role: Role;

  /* Customer-only fields */
  @Column({ type: 'varchar', length: 255, nullable: true })
  company_name: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  company_size: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  industry: string;

  /* Status & auth */
  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'timestamp', nullable: true })
  last_login_at: Date;

  @Column({ type: 'varchar', length: 255, nullable: true, select: false })
  refresh_token_hash: string;

  @Column({ type: 'varchar', length: 255, nullable: true, select: false })
  password_reset_token: string;

  @Column({ type: 'timestamp', nullable: true })
  password_reset_expires: Date;
}
