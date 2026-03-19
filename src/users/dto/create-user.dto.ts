import {
  IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MinLength,
} from 'class-validator';
import { Role } from '../../common/enums';

const INTERNAL_ROLES = [Role.ADMIN, Role.DEV] as const;
type InternalRole = typeof INTERNAL_ROLES[number];

export class CreateUserDto {
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

  @IsEnum(INTERNAL_ROLES, { message: 'role must be ADMIN or DEV' })
  role: InternalRole;
}
