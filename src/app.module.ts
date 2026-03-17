import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import * as path from 'path';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProjectsModule } from './projects/projects.module';
import { ChatModule } from './chat/chat.module';
import { AiModule } from './ai/ai.module';
import { StorageModule } from './storage/storage.module';
import { QueueModule } from './queue/queue.module';
import { TasksModule } from './tasks/tasks.module';
import { FinanceModule } from './finance/finance.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: path.resolve(process.cwd(), '../.env'),
    }),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        host: config.get<string>('DB_HOST') ?? 'localhost',
        port: config.get<number>('DB_PORT') ?? 5432,
        username: config.get<string>('DB_USER') ?? 'postgres',
        password: String(config.get<string>('DB_PASSWORD') ?? ''),
        database: String(config.get<string>('DB_NAME') ?? 'operisagent'),
        ssl: config.get('DB_SSL') === 'true'
          ? { rejectUnauthorized: false }
          : false,
        entities: [path.join(__dirname, 'entities/*.entity{.ts,.js}')],
        synchronize: false,
        logging: config.get('NODE_ENV') === 'development' ? ['error' as const] : false,
      }),
    }),

    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = new URL(config.get('REDIS_URL', 'redis://localhost:6379'));
        return {
          connection: { host: url.hostname, port: parseInt(url.port || '6379') },
        };
      },
    }),

    AuthModule,
    UsersModule,
    ProjectsModule,
    ChatModule,
    AiModule,
    StorageModule,
    QueueModule,
    TasksModule,
    FinanceModule,
    DashboardModule,
    NotificationsModule,
  ],
})
export class AppModule {}
