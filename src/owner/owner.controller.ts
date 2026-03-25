import {
  Controller,
  Get,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
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
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    const l = Math.min(limit, 100);
    const { data, total } = await this.ownerService.getProjects(page, l);
    return this.paginated(data, total, page, l);
  }

  @Get('finance/summary')
  async getFinanceSummary() {
    const summary = await this.ownerService.getFinanceSummary();
    return this.success(summary);
  }

  @Get('batches')
  async getBatches(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    const l = Math.min(limit, 100);
    const { data, total } = await this.ownerService.getBatches(page, l);
    return this.paginated(data, total, page, l);
  }

  @Get('candidates')
  async getCandidates(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    const l = Math.min(limit, 100);
    const { data, total } = await this.ownerService.getCandidates(page, l);
    return this.paginated(data, total, page, l);
  }
}
