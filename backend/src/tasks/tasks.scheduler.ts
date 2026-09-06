import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TasksService } from './tasks.service';

@Injectable()
export class TasksScheduler {
  private readonly logger = new Logger(TasksScheduler.name);

  constructor(private readonly tasksService: TasksService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async markOverdue() {
    if (process.env.NODE_ENV === 'test') {
      return;
    }
    try {
      await this.tasksService.markOverdue();
    } catch (error) {
      this.logger.warn(
        `Overdue sweep failed: ${error instanceof Error ? error.message : 'unknown'}`,
      );
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async spawnRecurring() {
    if (process.env.NODE_ENV === 'test') {
      return;
    }
    try {
      await this.tasksService.spawnDueRecurrences();
    } catch (error) {
      this.logger.warn(
        `Recurrence sweep failed: ${error instanceof Error ? error.message : 'unknown'}`,
      );
    }
  }
}
