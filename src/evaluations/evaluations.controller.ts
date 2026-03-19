import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { BaseController } from '../common/controllers/base.controller';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '../common/enums';
import { ApiResponse } from '../common/interfaces/api-response.interface';
import { EvaluationsService } from './evaluations.service';
import { CreateEvaluationDto } from './dto/create-evaluation.dto';
import { UpdateEvaluationDto } from './dto/update-evaluation.dto';

@UseGuards(JwtAuthGuard)
@Controller('evaluations')
export class EvaluationsController extends BaseController {
  constructor(private readonly evaluationsService: EvaluationsService) {
    super();
  }

  /** POST /evaluations — admin creates evaluation */
  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async create(
    @CurrentUser('id') evaluatorId: string,
    @Body() dto: CreateEvaluationDto,
  ): Promise<ApiResponse> {
    const evaluation = await this.evaluationsService.createEvaluation(evaluatorId, dto);
    return this.success(evaluation, 'Evaluation created');
  }

  /** GET /evaluations/:id — admin or team member */
  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: Role,
  ): Promise<ApiResponse> {
    const evaluation = await this.evaluationsService.getEvaluationForUser(
      id,
      userId,
      role === Role.ADMIN,
    );
    return this.success(evaluation);
  }

  /** PATCH /evaluations/:id — admin updates scores */
  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEvaluationDto,
  ): Promise<ApiResponse> {
    const evaluation = await this.evaluationsService.updateEvaluation(id, dto);
    return this.success(evaluation, 'Evaluation updated');
  }
}
