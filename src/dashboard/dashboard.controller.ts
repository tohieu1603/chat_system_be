import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { BaseController } from '../common/controllers/base.controller';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums';
import { ApiResponse } from '../common/interfaces/api-response.interface';
import { DashboardService } from './dashboard.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('dashboard')
export class DashboardController extends BaseController {
  constructor(private readonly dashboardService: DashboardService) {
    super();
  }

  /** GET /dashboard/stats */
  @Get('stats')
  async getStats(): Promise<ApiResponse> {
    const stats = await this.dashboardService.getStats();
    return this.success(stats);
  }

  /** GET /dashboard/recent-activity */
  @Get('recent-activity')
  async getRecentActivity(
    @Query('limit') limit?: string,
  ): Promise<ApiResponse> {
    const parsedLimit = limit ? parseInt(limit, 10) : 10;
    const projects = await this.dashboardService.getRecentActivity(parsedLimit);
    return this.success(projects);
  }
}
