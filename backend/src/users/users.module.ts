import { Module } from '@nestjs/common';
import { SystemRolesGuard } from '../common/guards/system-roles.guard';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService, SystemRolesGuard],
  exports: [UsersService],
})
export class UsersModule {}
