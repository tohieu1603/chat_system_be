import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  ParseIntPipe,
  DefaultValuePipe,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { BaseController } from '../common/controllers/base.controller';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Role } from '../common/enums';
import { KimiChatService } from './kimi-chat.service';

class CreateConversationDto {
  @IsOptional()
  @IsString()
  plan_id?: string;
}

class SendMessageDto {
  @IsNotEmpty()
  @IsString()
  content!: string;
}

class AskSectionDto {
  @IsNotEmpty()
  @IsString()
  plan_id!: string;

  @IsNotEmpty()
  @IsString()
  section_name!: string;

  @IsNotEmpty()
  @IsString()
  current_content!: string;

  @IsNotEmpty()
  @IsString()
  question!: string;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.CANDIDATE)
@Controller('kimi-chat')
export class KimiChatController extends BaseController {
  constructor(private readonly kimiChatService: KimiChatService) {
    super();
  }

  /** POST /kimi-chat/conversations — create a new conversation */
  @Post('conversations')
  async createConversation(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateConversationDto,
  ) {
    const conv = await this.kimiChatService.createConversation(userId, dto.plan_id);
    return this.success(conv, 'Cuộc trò chuyện mới đã được tạo');
  }

  /** GET /kimi-chat/conversations — list user conversations */
  @Get('conversations')
  async listConversations(@CurrentUser('id') userId: string) {
    const convs = await this.kimiChatService.getConversations(userId);
    return this.success(convs);
  }

  /** POST /kimi-chat/conversations/:id/messages — send message (SSE streaming) */
  @Post('conversations/:id/messages')
  async sendMessage(
    @Param('id', ParseUUIDPipe) conversationId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: SendMessageDto,
    @Res() res: Response,
  ) {
    try {
      await this.kimiChatService.sendMessage(conversationId, userId, dto.content, res);
    } catch (err: any) {
      if (!res.headersSent) {
        res.status(err.status ?? 500).json({
          success: false,
          message: err.message ?? 'Internal server error',
        });
      }
    }
  }

  /** GET /kimi-chat/conversations/:id/messages — message history */
  @Get('conversations/:id/messages')
  async getMessages(
    @Param('id', ParseUUIDPipe) conversationId: string,
    @CurrentUser('id') userId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    const result = await this.kimiChatService.getMessages(conversationId, userId, page, limit);
    return this.paginated(result.data, result.total, result.page, result.limit);
  }

  /** POST /kimi-chat/ask-section — Ask Kimi for plan section help */
  @Post('ask-section')
  async askSection(
    @CurrentUser('id') userId: string,
    @Body() dto: AskSectionDto,
    @Res() res: Response,
  ) {
    await this.kimiChatService.askSection(
      userId,
      dto.plan_id,
      dto.section_name,
      dto.current_content,
      dto.question,
      res,
    );
  }
}
