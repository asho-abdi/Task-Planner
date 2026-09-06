import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

export const SYSTEM_ROLES_KEY = 'systemRoles';
export const SystemRoles = (...roles: Role[]) =>
  SetMetadata(SYSTEM_ROLES_KEY, roles);
