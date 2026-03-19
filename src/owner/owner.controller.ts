import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { BaseController } from '../common/controllers/base.controller';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums';
import { OwnerService } from './owner.service';

@Controller('owner')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class OwnerController extends BaseController {
  constructor(private readonly ownerService: OwnerService) {
    super();
  }

  @Get('dashboard')
  async getDashboard() {
    const stats = await this.ownerService.getDashboard();
    return this.success(stats);
  }

  @Get('projects')
  async getProjects(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const p = page ? parseInt(page, 10) : 1;
    const l = limit ? parseInt(limit, 10) : 20;
    const { data, total } = await this.ownerService.getProjects(p, l);
    return this.paginated(data, total, p, l);
  }

  @Get('finance/summary')
  async getFinanceSummary() {
    const summary = await this.ownerService.getFinanceSummary();
    return this.success(summary);
  }

  @Get('batches')
  async getBatches(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const p = page ? parseInt(page, 10) : 1;
    const l = limit ? parseInt(limit, 10) : 20;
    const { data, total } = await this.ownerService.getBatches(p, l);
    return this.paginated(data, total, p, l);
  }

  @Get('candidates')
  async getCandidates(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const p = page ? parseInt(page, 10) : 1;
    const l = limit ? parseInt(limit, 10) : 20;
    const { data, total } = await this.ownerService.getCandidates(p, l);
    return this.paginated(data, total, p, l);
  }
}
