import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
} from '@nestjs/common';
import {
  CurrentMembership,
  CurrentUser,
  WorkspaceScoped,
} from '../common/decorators/workspace.decorators';
import type {
  AuthUser,
  WorkspaceMembershipContext,
} from '../common/types/request-context';
import { AiService } from './ai.service';
import {
  AssistAiDto,
  ExtractAiDto,
  PlanAiDto,
  PlanDayDto,
  ReportNarrativeDto,
} from './dto/ai.dto';

@Controller('ai')
@WorkspaceScoped()
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Get('status')
  status() {
    return this.aiService.status();
  }

  @Post('plan')
  plan(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @Body() dto: PlanAiDto,
  ) {
    return this.aiService.plan(membership, dto);
  }

  @Post('assist')
  assist(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @Body() dto: AssistAiDto,
  ) {
    return this.aiService.assist(membership, dto);
  }

  @Post('extract')
  extract(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @Body() dto: ExtractAiDto,
  ) {
    if (!dto.text?.trim() && !dto.meetingId) {
      throw new BadRequestException(
        'Provide notes text or a meeting to extract tasks from',
      );
    }
    return this.aiService.extract(membership, dto);
  }

  @Post('report-narrative')
  reportNarrative(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @Body() dto: ReportNarrativeDto,
  ) {
    return this.aiService.reportNarrative(membership, dto);
  }

  @Post('plan-day')
  planDay(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @CurrentUser() user: AuthUser,
    @Body() dto: PlanDayDto,
  ) {
    return this.aiService.planDay(membership, user.id, dto);
  }
}
