import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Batch } from '../entities/batch.entity';
import { BatchesService } from './batches.service';
import { BatchesController } from './batches.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Batch])],
  providers: [BatchesService],
  controllers: [BatchesController],
  exports: [BatchesService],
})
export class BatchesModule {}
