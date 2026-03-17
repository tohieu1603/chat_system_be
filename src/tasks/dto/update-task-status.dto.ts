import { IsEnum } from 'class-validator';
import { TaskStatus } from '../../common/enums';

export class UpdateTaskStatusDto {
  @IsEnum(TaskStatus)
  status: TaskStatus;
}
