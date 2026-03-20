import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { BaseController } from '../common/controllers/base.controller';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums';
import { ApiResponse } from '../common/interfaces/api-response.interface';
import { PaginationDto } from '../common/dto/pagination.dto';
import { BatchesService } from './batches.service';
import { CreateBatchDto } from './dto/create-batch.dto';
import { UpdateBatchDto } from './dto/update-batch.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../common/enums';

@Controller('batches')
export class BatchesController extends BaseController {
  constructor(
    private readonly batchesService: BatchesService,
    private readonly notificationsService: NotificationsService,
  ) {
    super();
  }

  /** GET /batches — public, paginated */
  @Get()
  async findAll(@Query() query: PaginationDto): Promise<ApiResponse> {
    const { data, total, page, limit } = await this.batchesService.listBatches(query);
    return this.paginated(data, total, page, limit);
  }

  /** GET /batches/:id — single batch with stats */
  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse> {
    const batch = await this.batchesService.findByIdOrFail(id);
    const stats = await this.batchesService.getBatchStats(id);
    return this.success({ ...batch, stats });
  }

  /** POST /batches — create (ADMIN only) */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async create(@Body() dto: CreateBatchDto): Promise<ApiResponse> {
    const batch = await this.batchesService.createBatch(dto);
    return this.success(batch, 'Batch created successfully');
  }

  /** PATCH /batches/:id — update (ADMIN only) */
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBatchDto,
  ): Promise<ApiResponse> {
    const batch = await this.batchesService.updateBatch(id, dto);
    return this.success(batch, 'Batch updated');
  }

  /** DELETE /batches/:id — soft delete (ADMIN only) */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse> {
    await this.batchesService.removeBatch(id);
    return this.ok('Batch deleted');
  }

  /** GET /batches/:id/stats — team count, candidate count, plan count */
  @Get(':id/stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async getStats(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse> {
    const stats = await this.batchesService.getBatchStats(id);
    return this.success(stats);
  }

  /** POST /batches/:id/notify-closing — admin sends closing notification to all candidates */
  @Post(':id/notify-closing')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async notifyClosing(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse> {
    const batch = await this.batchesService.findByIdOrFail(id);
    const candidates = await this.batchesService.getCandidatesByBatch(id);
    let count = 0;
    for (const c of candidates) {
      await this.notificationsService.notifyUser(
        c.user_id,
        'Đợt tuyển sắp đóng',
        `Đợt tuyển "${batch.name}" sắp đóng — hãy nộp kế hoạch trước hạn!`,
        NotificationType.WARNING, 'batch', id,
      );
      count++;
    }
    return this.success({ notified: count }, `Đã gửi thông báo đến ${count} ứng viên`);
  }
}
