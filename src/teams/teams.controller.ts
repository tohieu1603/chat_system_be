import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
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

  /** GET /teams — list all teams (admin only) */
  @Get()
  @Roles(Role.ADMIN)
  @UseGuards(RolesGuard)
  async listTeams(): Promise<ApiResponse> {
    const result = await this.teamsService.findAll(
      { page: 1, limit: 100 },
      { relations: ['members', 'members.user', 'batch'] },
    );
    return this.success(result.data);
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

  /** GET /teams/:id — team detail with members (admin or team member) */
  @Get(':id')
  async getTeam(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
  ): Promise<ApiResponse> {
    const team = await this.teamsService.getTeamDetail(id);
    if (role !== Role.ADMIN) {
      const isMember = team.members?.some((m: any) => m.user_id === userId);
      if (!isMember) {
        throw new ForbiddenException('Access denied');
      }
    }
    return this.success(team);
  }

  /** DELETE /teams/:id — admin delete team */
  @Delete(':id')
  @Roles(Role.ADMIN)
  @UseGuards(RolesGuard)
  async deleteTeam(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse> {
    await this.teamsService.remove(id);
    return this.success(null, 'Đã xóa đội nhóm');
  }
}
