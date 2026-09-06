import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { WorkspaceRole } from '@prisma/client';

export class CreateWorkspaceDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(350000)
  logo?: string;
}

export class UpdateWorkspaceDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(350000)
  logo?: string;
}

export class InviteMemberDto {
  @IsEmail()
  email!: string;

  @IsIn([WorkspaceRole.ADMIN, WorkspaceRole.MEMBER, WorkspaceRole.VIEWER])
  role!: WorkspaceRole;
}

export class AcceptInvitationDto {
  @IsString()
  @MinLength(16)
  token!: string;
}

export class DeclineInvitationDto {
  @IsOptional()
  @IsString()
  @MinLength(16)
  token?: string;

  @IsOptional()
  @IsString()
  invitationId?: string;
}

export class UpdateMemberRoleDto {
  @IsIn([WorkspaceRole.ADMIN, WorkspaceRole.MEMBER, WorkspaceRole.VIEWER])
  role!: WorkspaceRole;
}
