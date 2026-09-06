import { Module } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { RemindersService } from './reminders.service';

@Module({
  imports: [RealtimeModule],
  controllers: [NotificationsController],
  providers: [RemindersService, NotificationsService],
  exports: [RemindersService, NotificationsService],
})
export class NotificationsModule {}
