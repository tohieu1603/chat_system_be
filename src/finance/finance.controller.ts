import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { BaseController } from '../common/controllers/base.controller';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '../common/enums';
import { ApiResponse } from '../common/interfaces/api-response.interface';
import { FinanceService } from './finance.service';
import { CreateFinanceDto } from './dto/create-finance.dto';
import { UpdateFinanceDto } from './dto/update-finance.dto';
import { PaginationDto } from '../common/dto/pagination.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class FinanceController extends BaseController {
  constructor(private readonly financeService: FinanceService) {
    super();
  }

  /** GET /projects/:projectId/finance — list finance records for project */
  @Get('projects/:projectId/finance')
  @Roles(Role.ADMIN, Role.FINANCE)
  async findByProject(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query() query: PaginationDto,
  ): Promise<ApiResponse> {
    const { data, total, page, limit } = await this.financeService.findByProject(projectId, query);
    return this.paginated(data, total, page, limit);
  }

  /** POST /projects/:projectId/finance — create finance record */
  @Post('projects/:projectId/finance')
  @Roles(Role.FINANCE)
  async createRecord(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateFinanceDto,
  ): Promise<ApiResponse> {
    const record = await this.financeService.createRecord(projectId, userId, dto);
    return this.success(record, 'Finance record created');
  }

  /** PUT /finance/:id — update finance record */
  @Put('finance/:id')
  @Roles(Role.FINANCE)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFinanceDto,
  ): Promise<ApiResponse> {
    const record = await this.financeService.updateRecord(id, dto);
    return this.success(record, 'Finance record updated');
  }

  /** GET /finance/records — all finance records */
  @Get('finance/records')
  @Roles(Role.ADMIN, Role.FINANCE)
  async findAll(@Query() query: PaginationDto): Promise<ApiResponse> {
    const { data, total, page, limit } = await this.financeService.findAll(query);
    return this.paginated(data, total, page, limit);
  }

  /** GET /finance/summary — aggregated summary */
  @Get('finance/summary')
  @Roles(Role.ADMIN, Role.FINANCE)
  async getSummary(): Promise<ApiResponse> {
    const summary = await this.financeService.getSummary();
    return this.success(summary);
  }
}
