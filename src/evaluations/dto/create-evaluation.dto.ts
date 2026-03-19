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
import { EvaluationRecommendation } from '../../common/enums';

export class CreateEvaluationDto {
  @IsNotEmpty()
  @IsUUID()
  plan_id: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  workflow_score?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  business_score?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  organic_score?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  ads_score?: number;

  @IsOptional()
  @IsString()
  strengths?: string;

  @IsOptional()
  @IsString()
  weaknesses?: string;

  @IsOptional()
  @IsString()
  improvement_notes?: string;

  @IsOptional()
  @IsEnum(EvaluationRecommendation)
  recommendation?: EvaluationRecommendation;
}
