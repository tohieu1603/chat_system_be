import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { EvaluationRecommendation } from '../../common/enums';

export class UpdateEvaluationDto {
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
