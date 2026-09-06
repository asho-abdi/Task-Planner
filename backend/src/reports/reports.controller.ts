import { Controller, Get, Query } from '@nestjs/common';
import {
  CurrentMembership,
  CurrentUser,
  WorkspaceScoped,
} from '../common/decorators/workspace.decorators';
import type {
  AuthUser,
  WorkspaceMembershipContext,
} from '../common/types/request-context';
import {
  DateQueryDto,
  ReportsQueryDto,
  RiskQueryDto,
  WorkloadQueryDto,
} from './reports.dto';
import { ReportsService } from './reports.service';

@Controller()
@WorkspaceScoped()
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('my-day')
  myDay(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @CurrentUser() user: AuthUser,
    @Query() query: DateQueryDto,
  ) {
    return this.reportsService.getMyDay(membership, user.id, query);
  }

  @Get('workload')
  workload(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @Query() query: WorkloadQueryDto,
  ) {
    return this.reportsService.getWorkload(membership, query);
  }

  @Get('risk')
  risk(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @Query() query: RiskQueryDto,
  ) {
    return this.reportsService.getRisk(membership, query);
  }

  @Get('reports')
  reports(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @Query() query: ReportsQueryDto,
  ) {
    return this.reportsService.getReports(membership, query);
  }

  @Get('dashboard')
  dashboard(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @CurrentUser() user: AuthUser,
  ) {
    return this.reportsService.getDashboard(membership, user.id);
  }
}
