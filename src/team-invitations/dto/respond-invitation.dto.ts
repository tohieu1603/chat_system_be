import { IsEnum, IsNotEmpty } from 'class-validator';
import { InvitationStatus } from '../../common/enums';

export class RespondInvitationDto {
  @IsNotEmpty()
  @IsEnum([InvitationStatus.ACCEPTED, InvitationStatus.DECLINED], {
    message: 'status must be ACCEPTED or DECLINED',
  })
  status: InvitationStatus.ACCEPTED | InvitationStatus.DECLINED;
}
