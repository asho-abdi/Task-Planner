import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AiModule } from './ai/ai.module';
import { AuthModule } from './auth/auth.module';
import { AutomationsModule } from './automations/automations.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import configuration from './config/configuration';
import { validateEnv } from './config/env.validation';
import { ChatModule } from './chat/chat.module';
import { ActivityModule } from './activity/activity.module';
import { RealtimeModule } from './realtime/realtime.module';
import { FilesModule } from './files/files.module';
import { GoalsModule } from './goals/goals.module';
import { HealthModule } from './health/health.module';
import { MailModule } from './mail/mail.module';
import { MeetingsModule } from './meetings/meetings.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PagesModule } from './pages/pages.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProjectsModule } from './projects/projects.module';
import { RedisModule } from './redis/redis.module';
import { ReportsModule } from './reports/reports.module';
import { TasksModule } from './tasks/tasks.module';
import { TeamsModule } from './teams/teams.module';
import { TodosModule } from './todos/todos.module';
import { UsersModule } from './users/users.module';
import { WorkspacesModule } from './workspaces/workspaces.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: () => {
        validateEnv();
        return process.env;
      },
    }),
    ThrottlerModule.forRoot({
      skipIf: (context) => context.getType() !== 'http',
      throttlers: [{ ttl: 60000, limit: 120 }],
    }),
    PrismaModule,
    RedisModule,
    MailModule,
    ScheduleModule.forRoot(),
    HealthModule,
    AuthModule,
    UsersModule,
    WorkspacesModule,
    TeamsModule,
    ProjectsModule,
    TasksModule,
    MeetingsModule,
    TodosModule,
    NotificationsModule,
    ReportsModule,
    GoalsModule,
    AutomationsModule,
    AiModule,
    FilesModule,
    PagesModule,
    RealtimeModule,
    ActivityModule,
    ChatModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
