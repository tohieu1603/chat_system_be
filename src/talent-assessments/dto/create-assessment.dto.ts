import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { PotentialRole } from '../../common/enums';

export class CreateAssessmentDto {
  @IsNotEmpty()
  @IsUUID()
  user_id: string;

  @IsNotEmpty()
  @IsUUID()
  batch_id: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  business_thinking?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  marketing_ability?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  proactiveness?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  teamwork?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  learning_speed?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  resilience?: number;

  @IsOptional()
  @IsString()
  comments?: string;

  @IsOptional()
  @IsEnum(PotentialRole)
  potential_role?: PotentialRole;

  @IsOptional()
  @IsString()
  training_notes?: string;
}
