import {
  Body,
  Controller,
  Delete,
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
import { TeamInvitationsService } from './team-invitations.service';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { RespondInvitationDto } from './dto/respond-invitation.dto';

@UseGuards(JwtAuthGuard)
@Controller()
export class TeamInvitationsController extends BaseController {
  constructor(private readonly teamInvitationsService: TeamInvitationsService) {
    super();
  }

  /** POST /teams/:teamId/invitations — leader invites by email */
  @Post('teams/:teamId/invitations')
  async createInvitation(
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateInvitationDto,
  ): Promise<ApiResponse> {
    const invitation = await this.teamInvitationsService.createInvitation(teamId, userId, dto);
    return this.success(invitation, 'Invitation sent');
  }

  /** GET /invitations/pending — current user's pending invitations */
  @Get('invitations/pending')
  async getPending(
    @CurrentUser('email') email: string,
  ): Promise<ApiResponse> {
    const invitations = await this.teamInvitationsService.getPendingInvitations(email);
    return this.success(invitations);
  }

  /** PATCH /invitations/:id — accept or decline */
  @Patch('invitations/:id')
  async respond(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('email') email: string,
    @CurrentUser('id') userId: string,
    @Body() dto: RespondInvitationDto,
  ): Promise<ApiResponse> {
    const invitation = await this.teamInvitationsService.respondToInvitation(id, email, userId, dto);
    return this.success(invitation, `Invitation ${dto.status.toLowerCase()}`);
  }

  /** DELETE /invitations/:id — inviter cancels */
  @Delete('invitations/:id')
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ): Promise<ApiResponse> {
    await this.teamInvitationsService.cancelInvitation(id, userId);
    return this.ok('Invitation cancelled');
  }
}
