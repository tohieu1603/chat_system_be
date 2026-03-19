import { PartialType } from '@nestjs/mapped-types';
import { IsEnum, IsOptional } from 'class-validator';
import { CreateBatchDto } from './create-batch.dto';
import { BatchStatus } from '../../common/enums';

export class UpdateBatchDto extends PartialType(CreateBatchDto) {
  @IsOptional()
  @IsEnum(BatchStatus)
  status?: BatchStatus;
}
