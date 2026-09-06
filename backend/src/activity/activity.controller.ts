import { Controller, Get } from '@nestjs/common';
import {
  CurrentMembership,
  WorkspaceScoped,
} from '../common/decorators/workspace.decorators';
import type { WorkspaceMembershipContext } from '../common/types/request-context';
import { ActivityService } from './activity.service';

@Controller('activity')
@WorkspaceScoped()
export class ActivityController {
  constructor(private readonly activity: ActivityService) {}

  @Get()
  list(@CurrentMembership() membership: WorkspaceMembershipContext) {
    return this.activity.list(membership.workspaceId);
  }
}
