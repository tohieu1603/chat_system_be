import {
  Body,
  Controller,
  Delete,
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
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { QueryTasksDto } from './dto/query-tasks.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';
import { AssignTaskDto } from './dto/assign-task.dto';
import { CreateCommentDto } from './dto/create-comment.dto';

@UseGuards(JwtAuthGuard)
@Controller()
export class TasksController extends BaseController {
  constructor(private readonly tasksService: TasksService) {
    super();
  }

  /** GET /projects/:projectId/tasks — list tasks for a project */
  @Get('projects/:projectId/tasks')
  async findByProject(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query() query: QueryTasksDto,
  ): Promise<ApiResponse> {
    const { data, total, page, limit } = await this.tasksService.findByProject(projectId, query);
    return this.paginated(data, total, page, limit);
  }

  /** POST /projects/:projectId/tasks/generate — AI auto-generate tasks */
  @Post('projects/:projectId/tasks/generate')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async generateTasks(
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ): Promise<ApiResponse> {
    const tasks = await this.tasksService.generateTasks(projectId);
    return this.success(tasks, `Đã tạo ${tasks.length} tasks và giao cho dev`);
  }

  /** POST /projects/:projectId/tasks — create task */
  @Post('projects/:projectId/tasks')
  async createTask(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: CreateTaskDto,
  ): Promise<ApiResponse> {
    const task = await this.tasksService.createTask(projectId, dto);
    return this.success(task, 'Task created');
  }

  /** GET /tasks/all — all tasks (admin only) */
  @Get('tasks/all')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async getAllTasks(
    @Query() query: QueryTasksDto,
  ): Promise<ApiResponse> {
    const { data, total, page, limit } = await this.tasksService.findAll(query);
    return this.paginated(data, total, page, limit);
  }

  /** GET /tasks/my-tasks — tasks assigned to current DEV user */
  @Get('tasks/my-tasks')
  async getMyTasks(
    @CurrentUser('id') userId: string,
    @Query() query: QueryTasksDto,
  ): Promise<ApiResponse> {
    const { data, total, page, limit } = await this.tasksService.findMyTasks(userId, query);
    return this.paginated(data, total, page, limit);
  }

  /** GET /tasks/:id — task detail */
  @Get('tasks/:id')
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse> {
    const task = await this.tasksService.findByIdOrFail(id, ['assignee', 'project']);
    return this.success(task);
  }

  /** PUT /tasks/:id — update task */
  @Put('tasks/:id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTaskDto,
  ): Promise<ApiResponse> {
    const task = await this.tasksService.updateTask(id, dto);
    return this.success(task, 'Task updated');
  }

  /** PUT /tasks/:id/status — change task status */
  @Put('tasks/:id/status')
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTaskStatusDto,
  ): Promise<ApiResponse> {
    const task = await this.tasksService.updateStatus(id, dto.status);
    return this.success(task, `Status updated to ${dto.status}`);
  }

  /** PUT /tasks/:id/assign — assign task to user (admin only) */
  @Put('tasks/:id/assign')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async assignTask(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignTaskDto,
  ): Promise<ApiResponse> {
    const task = await this.tasksService.assignTask(id, dto.assignee_id);
    return this.success(task, 'Task assigned');
  }

  /** DELETE /tasks/:id — delete task (admin only) */
  @Delete('tasks/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse> {
    await this.tasksService.remove(id);
    return this.ok('Task deleted');
  }

  /** POST /tasks/:id/comments — add comment */
  @Post('tasks/:id/comments')
  async addComment(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateCommentDto,
  ): Promise<ApiResponse> {
    const comment = await this.tasksService.addComment(id, userId, dto.content);
    return this.success(comment, 'Comment added');
  }

  /** GET /tasks/:id/comments — list comments */
  @Get('tasks/:id/comments')
  async getComments(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse> {
    const comments = await this.tasksService.getComments(id);
    return this.success(comments);
  }
}
