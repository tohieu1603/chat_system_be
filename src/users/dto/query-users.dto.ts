import { IsEnum, IsOptional } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { Role } from '../../common/enums';

export class QueryUsersDto extends PaginationDto {
  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}
