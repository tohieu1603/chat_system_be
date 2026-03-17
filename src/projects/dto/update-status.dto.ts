import { IsEnum } from 'class-validator';
import { ProjectStatus } from '../../common/enums';

export class UpdateStatusDto {
  @IsEnum(ProjectStatus)
  status: ProjectStatus;
}
