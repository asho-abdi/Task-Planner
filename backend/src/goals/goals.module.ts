import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { GoalsController } from './goals.controller';
import { GoalsService } from './goals.service';

@Module({
  imports: [ProjectsModule],
  controllers: [GoalsController],
  providers: [GoalsService],
})
export class GoalsModule {}
