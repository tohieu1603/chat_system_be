import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { PlanStatus } from '../../common/enums';

export class UpdatePlanStatusDto {
  @IsNotEmpty()
  @IsEnum(PlanStatus)
  status: PlanStatus;

  @IsOptional()
  @IsString()
  improvement_notes?: string;
}
