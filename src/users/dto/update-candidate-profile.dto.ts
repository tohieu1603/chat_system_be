import {
  IsArray,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';

export class UpdateCandidateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  university?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  year_of_study?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  major?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills?: string[];

  @IsOptional()
  @IsUrl()
  cv_url?: string;

  @IsOptional()
  @IsUrl()
  linkedin_url?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  motivation?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  hours_per_week?: string;
}
