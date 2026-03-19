import {
  Body,
  Controller,
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
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '../common/enums';
import { ApiResponse } from '../common/interfaces/api-response.interface';
import { BusinessPlansService } from './business-plans.service';
import { PlanConversionService } from './plan-conversion.service';
import { EvaluationsService } from '../evaluations/evaluations.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { UpdatePlanStatusDto } from './dto/update-plan-status.dto';
import { QueryPlansDto } from './dto/query-plans.dto';

@UseGuards(JwtAuthGuard)
@Controller('business-plans')
export class BusinessPlansController extends BaseController {
  constructor(
    private readonly plansService: BusinessPlansService,
    private readonly planConversionService: PlanConversionService,
    private readonly evaluationsService: EvaluationsService,
  ) {
    super();
  }

  /** POST /business-plans — candidate creates a plan (must have team in open batch) */
  @Post()
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreatePlanDto,
  ): Promise<ApiResponse> {
    const plan = await this.plansService.createPlan(userId, dto);
    return this.success(plan, 'Business plan created');
  }

  /** GET /business-plans/my-plan — current user's team plan */
  @Get('my-plan')
  async getMyPlan(@CurrentUser('id') userId: string): Promise<ApiResponse> {
    const plan = await this.plansService.getMyPlan(userId);
    return this.success(plan);
  }

  /** GET /business-plans — admin list all plans with filters */
  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async findAll(@Query() query: QueryPlansDto): Promise<ApiResponse> {
    const { data, total, page, limit } = await this.plansService.findAll(query);
    return this.paginated(data, total, page, limit);
  }

  /** GET /business-plans/:id — team member or admin */
  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: Role,
  ): Promise<ApiResponse> {
    const plan = await this.plansService.getPlanForUser(id, userId, role === Role.ADMIN);
    return this.success(plan);
  }

  /** PATCH /business-plans/:id — auto-save sections (team member, draft only) */
  @Patch(':id')
  async autoSave(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdatePlanDto,
  ): Promise<ApiResponse> {
    const plan = await this.plansService.autoSave(id, userId, dto);
    return this.success(plan, 'Plan saved');
  }

  /** POST /business-plans/:id/submit — team leader submits plan */
  @Post(':id/submit')
  async submit(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ): Promise<ApiResponse> {
    const plan = await this.plansService.submitPlan(id, userId);
    return this.success(plan, 'Plan submitted successfully');
  }

  /** PATCH /business-plans/:id/status — admin updates plan status */
  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePlanStatusDto,
  ): Promise<ApiResponse> {
    const plan = await this.plansService.updateStatus(id, dto);
    return this.success(plan, `Status updated to ${dto.status}`);
  }

  /** POST /business-plans/:id/convert — admin converts approved plan to project */
  @Post(':id/convert')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async convertToProject(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') adminId: string,
  ): Promise<ApiResponse> {
    const project = await this.planConversionService.convertToProject(id, adminId);
    return this.success(project, 'Kế hoạch đã được chuyển thành dự án');
  }

  /** GET /business-plans/:planId/evaluation — get evaluation for a plan */
  @Get(':planId/evaluation')
  async getEvaluation(
    @Param('planId', ParseUUIDPipe) planId: string,
  ): Promise<ApiResponse> {
    const evaluation = await this.evaluationsService.getEvaluationByPlan(planId);
    return this.success(evaluation);
  }
}
