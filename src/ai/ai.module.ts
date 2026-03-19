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
import { KimiChatService } from './kimi-chat.service';
import { KimiChatController } from './kimi-chat.controller';
import { KimiConversation } from './kimi-conversation.entity';
import { KimiMessage } from './kimi-message.entity';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([CollectionData, Project, Message, KimiConversation, KimiMessage]),
  ],
  controllers: [KimiChatController],
  providers: [AiService, PromptService, ToolHandlerService, FallbackExtractorService, KimiChatService],
  exports: [AiService, PromptService, ToolHandlerService, FallbackExtractorService, KimiChatService],
})
export class AiModule {}
