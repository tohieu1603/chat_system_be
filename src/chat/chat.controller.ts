import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  ParseIntPipe,
  DefaultValuePipe,
  ForbiddenException,
} from '@nestjs/common';
import { BaseController } from '../common/controllers/base.controller';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ChatService } from './chat.service';
import { ApiResponse } from '../common/interfaces/api-response.interface';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '../common/enums';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from '../entities/project.entity';

@UseGuards(JwtAuthGuard)
@Controller()
export class ChatController extends BaseController {
  constructor(
    private readonly chatService: ChatService,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
  ) {
    super();
  }

  private async assertProjectAccess(projectId: string, userId: string, role: string): Promise<void> {
    if (role === Role.ADMIN) return;
    const project = await this.projectRepo.findOne({ where: { id: projectId } });
    if (!project || project.customer_id !== userId) {
      throw new ForbiddenException('Access denied');
    }
  }

  @Get('projects/:projectId/conversations')
  async listByProject(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
  ): Promise<ApiResponse<any>> {
    await this.assertProjectAccess(projectId, userId, role);
    const conversations = await this.chatService.findByProject(projectId);
    return this.success(conversations);
  }

  @Get('conversations/:id')
  async getConversation(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
  ): Promise<ApiResponse<any>> {
    const conversation = await this.chatService.findByIdOrFail(id);
    await this.assertProjectAccess(conversation.project_id, userId, role);
    return this.success(conversation);
  }

  @Get('conversations/:id/messages')
  async getMessages(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
  ): Promise<ApiResponse<any>> {
    const conversation = await this.chatService.findByIdOrFail(id);
    await this.assertProjectAccess(conversation.project_id, userId, role);
    const result = await this.chatService.getMessages(id, page, Math.min(limit, 100));
    return this.paginated(result.data, result.total, result.page, result.limit);
  }

  @Get('conversations/:id/collection-data')
  async getCollectionData(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
  ): Promise<ApiResponse<any>> {
    const conversation = await this.chatService.findByIdOrFail(id);
    await this.assertProjectAccess(conversation.project_id, userId, role);
    const data = await this.chatService.getCollectionData(id);
    return this.success(data);
  }
}
