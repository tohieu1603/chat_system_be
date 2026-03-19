import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Evaluation } from '../entities/evaluation.entity';
import { BusinessPlan } from '../entities/business-plan.entity';
import { TeamMember } from '../entities/team-member.entity';
import { EvaluationsService } from './evaluations.service';
import { EvaluationsController } from './evaluations.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Evaluation, BusinessPlan, TeamMember])],
  providers: [EvaluationsService],
  controllers: [EvaluationsController],
  exports: [EvaluationsService],
})
export class EvaluationsModule {}
