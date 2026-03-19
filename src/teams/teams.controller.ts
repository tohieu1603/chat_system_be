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
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ApiResponse } from '../common/interfaces/api-response.interface';
import { TeamsService } from './teams.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { JoinTeamDto } from './dto/join-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';

@UseGuards(JwtAuthGuard)
@Controller('teams')
export class TeamsController extends BaseController {
  constructor(private readonly teamsService: TeamsService) {
    super();
  }

  /** GET /teams/my-team — current user's team in active batch */
  @Get('my-team')
  async getMyTeam(@CurrentUser('id') userId: string): Promise<ApiResponse> {
    const team = await this.teamsService.getMyTeam(userId);
    return this.success(team);
  }

  /** POST /teams — create team (CANDIDATE only, auto-adds as leader) */
  @Post()
  async createTeam(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateTeamDto,
  ): Promise<ApiResponse> {
    const team = await this.teamsService.createTeam(userId, dto);
    return this.success(team, 'Team created successfully');
  }

  /** POST /teams/join — join by invite code (CANDIDATE only) */
  @Post('join')
  async joinTeam(
    @CurrentUser('id') userId: string,
    @Body() dto: JoinTeamDto,
  ): Promise<ApiResponse> {
    const team = await this.teamsService.joinTeam(userId, dto);
    return this.success(team, 'Joined team successfully');
  }

  /** PATCH /teams/:id — update name/desc (leader only) */
  @Patch(':id')
  async updateTeam(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateTeamDto,
  ): Promise<ApiResponse> {
    const team = await this.teamsService.updateTeam(id, userId, dto);
    return this.success(team, 'Team updated');
  }

  /** GET /teams/:id — team detail with members */
  @Get(':id')
  async getTeam(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse> {
    const team = await this.teamsService.getTeamDetail(id);
    return this.success(team);
  }
}
