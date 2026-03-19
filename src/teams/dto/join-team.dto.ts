import { IsNotEmpty, IsString, Length } from 'class-validator';

export class JoinTeamDto {
  @IsNotEmpty()
  @IsString()
  @Length(8, 8)
  invite_code: string;
}
