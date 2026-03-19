import { Entity, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { TeamRole } from '../common/enums';
import { Team } from './team.entity';
import { User } from './user.entity';

@Entity('team_members')
@Unique(['team_id', 'user_id'])
export class TeamMember extends BaseEntity {
  @Column({ type: 'uuid' })
  team_id: string;

  @ManyToOne(() => Team, (t) => t.members, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'team_id' })
  team: Team;

  @Column({ type: 'uuid' })
  user_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'enum', enum: TeamRole, default: TeamRole.MEMBER })
  role: TeamRole;

  @Column({ type: 'timestamp', default: () => 'now()' })
  joined_at: Date;
}
