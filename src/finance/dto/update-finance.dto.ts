import { PartialType } from '@nestjs/mapped-types';
import { IsEnum, IsOptional } from 'class-validator';
import { FinanceStatus } from '../../common/enums';
import { CreateFinanceDto } from './create-finance.dto';

export class UpdateFinanceDto extends PartialType(CreateFinanceDto) {
  @IsOptional()
  @IsEnum(FinanceStatus)
  status?: FinanceStatus;
}
