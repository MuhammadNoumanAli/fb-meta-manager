import { SetMetadata } from '@nestjs/common';
import type { PermissionKey } from '../constants/permissions';

export const PERMISSIONS_KEY = 'requiredPermissions';

/** Requires every listed permission in the current business or agency context. */
export const RequirePermissions = (...permissions: PermissionKey[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
