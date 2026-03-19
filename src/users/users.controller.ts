import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
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
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { QueryUsersDto } from './dto/query-users.dto';
import { UpdateCandidateProfileDto } from './dto/update-candidate-profile.dto';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController extends BaseController {
  constructor(private readonly usersService: UsersService) {
    super();
  }

  @Get('me')
  async getMe(@CurrentUser() user: { id: string }) {
    const found = await this.usersService.findByIdOrFail(user.id);
    return this.success(found);
  }

  @Put('me')
  async updateMe(
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateUserDto,
  ) {
    const updated = await this.usersService.update(user.id, dto);
    return this.success(updated);
  }

  @Get('profile/candidate')
  @Roles(Role.CANDIDATE)
  @UseGuards(RolesGuard)
  async getCandidateProfile(@CurrentUser() user: { id: string }) {
    const found = await this.usersService.findByIdOrFail(user.id);
    return this.success(found);
  }

  @Patch('profile/candidate')
  @Roles(Role.CANDIDATE)
  @UseGuards(RolesGuard)
  async updateCandidateProfile(
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateCandidateProfileDto,
  ) {
    const updated = await this.usersService.update(user.id, dto);
    return this.success(updated, 'Candidate profile updated');
  }

  @Get()
  @Roles(Role.ADMIN)
  @UseGuards(RolesGuard)
  async findAll(@Query() query: QueryUsersDto) {
    const { data, total, page, limit } = await this.usersService.findAllUsers(query);
    return this.paginated(data, total, page, limit);
  }

  @Get(':id')
  @Roles(Role.ADMIN)
  @UseGuards(RolesGuard)
  async findOne(@Param('id') id: string) {
    const user = await this.usersService.findByIdOrFail(id);
    return this.success(user);
  }

  @Post()
  @Roles(Role.ADMIN)
  @UseGuards(RolesGuard)
  async createInternal(@Body() dto: CreateUserDto) {
    const user = await this.usersService.createInternalUser(dto);
    return this.success(user, 'User created successfully');
  }

  @Put(':id')
  @Roles(Role.ADMIN)
  @UseGuards(RolesGuard)
  async update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    const updated = await this.usersService.update(id, dto);
    return this.success(updated);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @UseGuards(RolesGuard)
  async remove(@Param('id') id: string) {
    await this.usersService.softDelete(id);
    return this.ok('User deactivated successfully');
  }
}
