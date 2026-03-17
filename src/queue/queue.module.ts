import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { Project } from '../entities/project.entity';
import { CollectionData } from '../entities/collection-data.entity';
import { StorageModule } from '../storage/storage.module';
import { DocumentGeneratorProcessor } from './processors/document-generator.processor';

@Module({
  imports: [
    ConfigModule,
    BullModule.registerQueue({ name: 'document-generation' }),
    TypeOrmModule.forFeature([Project, CollectionData]),
    StorageModule,
  ],
  providers: [DocumentGeneratorProcessor],
  exports: [BullModule],
})
export class QueueModule {}
