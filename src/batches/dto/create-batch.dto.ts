import {
  IsNotEmpty, IsOptional, IsString, IsInt, Min, IsDateString, IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BatchStatus } from '../../common/enums';

export class CreateBatchDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(BatchStatus)
  status?: BatchStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  max_teams?: number;

  @IsOptional()
  @IsDateString()
  application_start?: string;

  @IsOptional()
  @IsDateString()
  application_end?: string;
}
