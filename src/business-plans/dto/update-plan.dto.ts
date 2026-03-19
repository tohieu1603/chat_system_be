import {
  IsOptional,
  IsString,
  IsArray,
  IsUrl,
} from 'class-validator';

/** Partial update for auto-save — all fields optional */
export class UpdatePlanDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  executive_summary?: string;

  @IsOptional()
  @IsString()
  problem_statement?: string;

  @IsOptional()
  @IsString()
  solution?: string;

  @IsOptional()
  @IsString()
  target_market?: string;

  @IsOptional()
  @IsString()
  customer_persona?: string;

  @IsOptional()
  @IsString()
  competitive_analysis?: string;

  @IsOptional()
  @IsString()
  organic_marketing?: string;

  @IsOptional()
  @IsString()
  paid_advertising?: string;

  @IsOptional()
  @IsString()
  operation_workflow?: string;

  @IsOptional()
  @IsString()
  payment_system?: string;

  @IsOptional()
  @IsString()
  tech_requirements?: string;

  @IsOptional()
  @IsString()
  cost_structure?: string;

  @IsOptional()
  @IsString()
  revenue_model?: string;

  @IsOptional()
  @IsArray()
  milestones?: Record<string, any>[];

  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  attachments?: string[];
}
