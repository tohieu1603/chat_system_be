import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessPlan } from '../entities/business-plan.entity';
import { TeamMember } from '../entities/team-member.entity';
import { Team } from '../entities/team.entity';
import { Batch } from '../entities/batch.entity';
import { Project } from '../entities/project.entity';
import { ProjectMember } from '../entities/project-member.entity';
import { Notification } from '../entities/notification.entity';
import { Task } from '../entities/task.entity';
import { User } from '../entities/user.entity';
import { BusinessPlansService } from './business-plans.service';
import { PlanConversionService } from './plan-conversion.service';
import { BusinessPlansController } from './business-plans.controller';
import { EvaluationsModule } from '../evaluations/evaluations.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([BusinessPlan, TeamMember, Team, Batch, Project, ProjectMember, Notification, Task, User]),
    EvaluationsModule,
    AiModule,
  ],
  providers: [BusinessPlansService, PlanConversionService],
  controllers: [BusinessPlansController],
  exports: [BusinessPlansService],
})
export class BusinessPlansModule {}
