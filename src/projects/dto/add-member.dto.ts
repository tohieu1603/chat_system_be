import { IsString, IsUUID } from 'class-validator';

export class AddMemberDto {
  @IsUUID()
  user_id: string;

  @IsString()
  role: string;
}
