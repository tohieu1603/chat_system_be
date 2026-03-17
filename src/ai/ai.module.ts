import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CollectionData } from '../entities/collection-data.entity';
import { Project } from '../entities/project.entity';
import { Message } from '../entities/message.entity';
import { AiService } from './ai.service';
import { PromptService } from './prompt.service';
import { ToolHandlerService } from './tool-handler.service';
import { FallbackExtractorService } from './fallback-extractor.service';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([CollectionData, Project, Message]),
  ],
  providers: [AiService, PromptService, ToolHandlerService, FallbackExtractorService],
  exports: [AiService, PromptService, ToolHandlerService, FallbackExtractorService],
})
export class AiModule {}
