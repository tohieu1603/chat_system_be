import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateProjectDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  project_name: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}
