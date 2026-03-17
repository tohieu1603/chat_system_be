import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateProjectDto {
  @IsNotEmpty()
  @IsString()
  project_name: string;

  @IsOptional()
  @IsString()
  description?: string;
}
