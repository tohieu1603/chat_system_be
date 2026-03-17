import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { BaseController } from '../common/controllers/base.controller';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ApiResponse } from '../common/interfaces/api-response.interface';
import { NotificationsService } from './notifications.service';
import { QueryNotificationsDto } from './dto/query-notifications.dto';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController extends BaseController {
  constructor(private readonly notificationsService: NotificationsService) {
    super();
  }

  /** GET /notifications — current user's paginated notifications */
  @Get()
  async findAll(
    @CurrentUser('id') userId: string,
    @Query() query: QueryNotificationsDto,
  ): Promise<ApiResponse> {
    const { data, total, page, limit } = await this.notificationsService.findByUser(userId, query);
    return this.paginated(data, total, page, limit);
  }

  /** GET /notifications/unread-count */
  @Get('unread-count')
  async getUnreadCount(@CurrentUser('id') userId: string): Promise<ApiResponse> {
    const count = await this.notificationsService.getUnreadCount(userId);
    return this.success({ count });
  }

  /** PUT /notifications/read-all — mark all as read */
  @Put('read-all')
  async markAllRead(@CurrentUser('id') userId: string): Promise<ApiResponse> {
    await this.notificationsService.markAllRead(userId);
    return this.ok('All notifications marked as read');
  }

  /** PUT /notifications/:id/read — mark single as read */
  @Put(':id/read')
  async markRead(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ): Promise<ApiResponse> {
    const notif = await this.notificationsService.markRead(id, userId);
    return this.success(notif, 'Notification marked as read');
  }
}
