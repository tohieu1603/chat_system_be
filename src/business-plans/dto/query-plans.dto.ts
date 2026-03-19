import { IsOptional, IsEnum, IsUUID } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { PlanStatus } from '../../common/enums';

export class QueryPlansDto extends PaginationDto {
  @IsOptional()
  @IsEnum(PlanStatus)
  status?: PlanStatus;

  @IsOptional()
  @IsUUID()
  batch_id?: string;
}
