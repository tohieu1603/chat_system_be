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
import { TalentAssessmentsService } from './talent-assessments.service';
import { CreateAssessmentDto } from './dto/create-assessment.dto';
import { UpdateAssessmentDto } from './dto/update-assessment.dto';
import { QueryAssessmentsDto } from './dto/query-assessments.dto';

@UseGuards(JwtAuthGuard)
@Controller('talent-assessments')
export class TalentAssessmentsController extends BaseController {
  constructor(private readonly assessmentsService: TalentAssessmentsService) {
    super();
  }

  /** POST /talent-assessments — admin creates assessment */
  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async create(
    @CurrentUser('id') evaluatorId: string,
    @Body() dto: CreateAssessmentDto,
  ): Promise<ApiResponse> {
    const assessment = await this.assessmentsService.createAssessment(evaluatorId, dto);
    return this.success(assessment, 'Talent assessment created');
  }

  /** GET /talent-assessments — admin list all, filterable by batch */
  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async findAll(@Query() query: QueryAssessmentsDto): Promise<ApiResponse> {
    const { data, total, page, limit } = await this.assessmentsService.findAll(query);
    return this.paginated(data, total, page, limit);
  }

  /** GET /talent-assessments/user/:userId — get assessments for a candidate */
  @Get('user/:userId')
  async getByUser(
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<ApiResponse> {
    const assessments = await this.assessmentsService.getAssessmentsByUser(userId);
    return this.success(assessments);
  }

  /** GET /talent-assessments/:id — get assessment detail */
  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponse> {
    const assessment = await this.assessmentsService.getAssessmentById(id);
    return this.success(assessment);
  }

  /** PATCH /talent-assessments/:id — admin updates assessment */
  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAssessmentDto,
  ): Promise<ApiResponse> {
    const assessment = await this.assessmentsService.updateAssessment(id, dto);
    return this.success(assessment, 'Assessment updated');
  }
}
