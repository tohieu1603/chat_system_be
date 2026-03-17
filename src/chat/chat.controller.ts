import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { BaseController } from '../common/controllers/base.controller';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ChatService } from './chat.service';
import { ApiResponse } from '../common/interfaces/api-response.interface';

@UseGuards(JwtAuthGuard)
@Controller()
export class ChatController extends BaseController {
  constructor(private readonly chatService: ChatService) {
    super();
  }

  @Get('projects/:projectId/conversations')
  async listByProject(
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ): Promise<ApiResponse<any>> {
    const conversations = await this.chatService.findByProject(projectId);
    return this.success(conversations);
  }

  @Get('conversations/:id')
  async getConversation(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponse<any>> {
    const conversation = await this.chatService.findByIdOrFail(id);
    return this.success(conversation);
  }

  @Get('conversations/:id/messages')
  async getMessages(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ): Promise<ApiResponse<any>> {
    const result = await this.chatService.getMessages(id, page, limit);
    return this.paginated(result.data, result.total, result.page, result.limit);
  }

  @Get('conversations/:id/collection-data')
  async getCollectionData(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponse<any>> {
    const data = await this.chatService.getCollectionData(id);
    return this.success(data);
  }
}
