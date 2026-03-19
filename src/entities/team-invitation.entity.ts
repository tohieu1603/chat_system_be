import { Entity, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { InvitationStatus } from '../common/enums';
import { Team } from './team.entity';
import { User } from './user.entity';

@Entity('team_invitations')
@Unique(['team_id', 'invited_email'])
export class TeamInvitation extends BaseEntity {
  @Column({ type: 'uuid' })
  team_id: string;

  @ManyToOne(() => Team, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'team_id' })
  team: Team;

  @Column({ type: 'varchar', length: 255 })
  invited_email: string;

  @Column({ type: 'uuid' })
  invited_by: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invited_by' })
  inviter: User;

  @Column({ type: 'enum', enum: InvitationStatus, default: InvitationStatus.PENDING })
  status: InvitationStatus;
}
