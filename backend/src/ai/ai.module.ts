import { Module } from '@nestjs/common';
import { ReportsModule } from '../reports/reports.module';
import { AiClient } from './ai.client';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';

@Module({
  imports: [ReportsModule],
  controllers: [AiController],
  providers: [AiClient, AiService],
})
export class AiModule {}
