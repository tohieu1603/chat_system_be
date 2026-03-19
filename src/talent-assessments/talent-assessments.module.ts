import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TalentAssessment } from '../entities/talent-assessment.entity';
import { TalentAssessmentsService } from './talent-assessments.service';
import { TalentAssessmentsController } from './talent-assessments.controller';

@Module({
  imports: [TypeOrmModule.forFeature([TalentAssessment])],
  providers: [TalentAssessmentsService],
  controllers: [TalentAssessmentsController],
  exports: [TalentAssessmentsService],
})
export class TalentAssessmentsModule {}
