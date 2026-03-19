import { IsEmail, IsNotEmpty } from 'class-validator';

export class CreateInvitationDto {
  @IsNotEmpty()
  @IsEmail()
  invited_email: string;
}
