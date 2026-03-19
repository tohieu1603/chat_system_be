import { IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class QueryAssessmentsDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  batch_id?: string;
}
