import {
  IsEnum, IsNumber, IsOptional, IsString, IsDateString, Min,
} from 'class-validator';
import { FinanceType } from '../../common/enums';

export class CreateFinanceDto {
  @IsEnum(FinanceType)
  type: FinanceType;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  due_date?: string;
}
