import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Task } from '../entities/task.entity';
import { TaskComment } from '../entities/task-comment.entity';
import { User } from '../entities/user.entity';
import { Project } from '../entities/project.entity';
import { AiModule } from '../ai/ai.module';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Task, TaskComment, User, Project]),
    AiModule,
  ],
  providers: [TasksService],
  controllers: [TasksController],
  exports: [TasksService],
})
export class TasksModule {}
