import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from '../entities/project.entity';
import { FinanceRecord } from '../entities/finance-record.entity';
import { Batch } from '../entities/batch.entity';
import { User } from '../entities/user.entity';
import { TalentAssessment } from '../entities/talent-assessment.entity';
import { OwnerService } from './owner.service';
import { OwnerController } from './owner.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Project,
      FinanceRecord,
      Batch,
      User,
      TalentAssessment,
    ]),
  ],
  providers: [OwnerService],
  controllers: [OwnerController],
})
export class OwnerModule {}
