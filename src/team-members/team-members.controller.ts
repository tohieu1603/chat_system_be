import {
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { BaseController } from '../common/controllers/base.controller';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ApiResponse } from '../common/interfaces/api-response.interface';
import { TeamMembersService } from './team-members.service';

@UseGuards(JwtAuthGuard)
@Controller('teams/:teamId/members')
export class TeamMembersController extends BaseController {
  constructor(private readonly teamMembersService: TeamMembersService) {
    super();
  }

  /** GET /teams/:teamId/members */
  @Get()
  async listMembers(
    @Param('teamId', ParseUUIDPipe) teamId: string,
  ): Promise<ApiResponse> {
    const members = await this.teamMembersService.listMembers(teamId);
    return this.success(members);
  }

  /** DELETE /teams/:teamId/members/:userId — leader only, cannot remove self */
  @Delete(':userId')
  async removeMember(
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Param('userId', ParseUUIDPipe) targetUserId: string,
    @CurrentUser('id') leaderId: string,
  ): Promise<ApiResponse> {
    await this.teamMembersService.removeMember(teamId, leaderId, targetUserId);
    return this.ok('Member removed successfully');
  }
}
