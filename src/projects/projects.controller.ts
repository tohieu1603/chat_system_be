import {
  Body,
  Controller,
  ForbiddenException,
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
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { QueryProjectsDto } from './dto/query-projects.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { AddMemberDto } from './dto/add-member.dto';

@UseGuards(JwtAuthGuard)
@Controller('projects')
export class ProjectsController extends BaseController {
  constructor(private readonly projectsService: ProjectsService) {
    super();
  }

  private async assertAccess(projectId: string, userId: string, role: string): Promise<void> {
    if (role === Role.ADMIN) return;
    const project = await this.projectsService.findByIdOrFail(projectId);
    if (project.customer_id !== userId) {
      throw new ForbiddenException('Access denied');
    }
  }

  /** GET /projects — list projects filtered by caller's role */
  @Get()
  async findAll(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: Role,
    @Query() query: QueryProjectsDto,
  ): Promise<ApiResponse> {
    const { data, total, page, limit } = await this.projectsService.findAllByRole(
      userId,
      role,
      query,
    );
    return this.paginated(data, total, page, limit);
  }

  /** POST /projects — customer creates a project */
  @Post()
  async create(
    @CurrentUser('id') customerId: string,
    @Body() dto: CreateProjectDto,
  ): Promise<ApiResponse> {
    const project = await this.projectsService.createProject(customerId, dto);
    return this.success(project, 'Project created successfully');
  }

  /** GET /projects/:id — project detail with customer */
  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
  ): Promise<ApiResponse> {
    await this.assertAccess(id, userId, role);
    const project = await this.projectsService.findByIdOrFail(id, ['customer']);
    return this.success(project);
  }

  /** PUT /projects/:id — update project fields */
  @Put(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
    @Body() dto: UpdateProjectDto,
  ): Promise<ApiResponse> {
    await this.assertAccess(id, userId, role);
    const project = await this.projectsService.update(id, dto);
    return this.success(project, 'Project updated');
  }

  /** PUT /projects/:id/status — admin changes status */
  @Put(':id/status')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStatusDto,
  ): Promise<ApiResponse> {
    const project = await this.projectsService.updateStatus(id, dto.status);
    return this.success(project, `Status updated to ${dto.status}`);
  }

  /** GET /projects/:id/progress — collection progress */
  @Get(':id/progress')
  async getProgress(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
  ): Promise<ApiResponse> {
    await this.assertAccess(id, userId, role);
    const progress = await this.projectsService.getProgress(id);
    return this.success(progress);
  }

  /** GET /projects/:id/document — requirement document info */
  @Get(':id/document')
  async getDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
  ): Promise<ApiResponse> {
    await this.assertAccess(id, userId, role);
    const doc = await this.projectsService.getDocument(id);
    return this.success(doc);
  }

  /** GET /projects/:id/members — list project members */
  @Get(':id/members')
  async getMembers(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
  ): Promise<ApiResponse> {
    await this.assertAccess(id, userId, role);
    const members = await this.projectsService.getMembers(id);
    return this.success(members);
  }

  /** POST /projects/:id/members — admin adds a member */
  @Post(':id/members')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async addMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddMemberDto,
  ): Promise<ApiResponse> {
    const member = await this.projectsService.addMember(id, dto.user_id, dto.role);
    return this.success(member, 'Member added');
  }

  /** POST /projects/:id/regenerate-document — generate requirement document (ADMIN only) */
  @Post(':id/regenerate-document')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async regenerateDocument(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponse> {
    const project = await this.projectsService.generateDocument(id);
    return this.success({
      requirement_json: project.requirement_json,
      requirement_doc_url: project.requirement_doc_url,
    }, 'Document generated');
  }
}
