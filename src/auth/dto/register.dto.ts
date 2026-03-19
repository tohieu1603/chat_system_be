import {
  IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MinLength,
} from 'class-validator';
import { Role } from '../../common/enums';

const REGISTERABLE_ROLES = [Role.CANDIDATE] as const;

export class RegisterDto {
  @IsEmail()
  email: string;

  @MinLength(8)
  password: string;

  @IsNotEmpty()
  @IsString()
  full_name: string;

  @IsOptional()
  @IsString()
  phone?: string;

  /** CANDIDATE only */
  @IsOptional()
  @IsEnum(REGISTERABLE_ROLES)
  role?: Role.CANDIDATE;

  /* Customer fields */
  @IsOptional()
  @IsString()
  company_name?: string;

  @IsOptional()
  @IsString()
  company_size?: string;

  @IsOptional()
  @IsString()
  industry?: string;

  /* Candidate fields */
  @IsOptional()
  @IsString()
  university?: string;

  @IsOptional()
  @IsString()
  year_of_study?: string;
}
