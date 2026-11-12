import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import type { PermissionKey } from '../constants/permissions';
import type { AuthenticatedUser } from '../types/authenticated-user';
import { AccessService } from '../../modules/access/access.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly accessService: AccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<PermissionKey[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<
      Request & { user: AuthenticatedUser; businessAccess?: unknown }
    >();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Authentication is required');
    }

    const businessId =
      typeof request.params.businessId === 'string'
        ? request.params.businessId
        : typeof request.query.businessId === 'string'
          ? request.query.businessId
          : null;
    const agencyId =
      typeof request.params.agencyId === 'string' ? request.params.agencyId : null;

    let granted: Set<string>;

    if (businessId) {
      const access = await this.accessService.getBusinessAccess(user.id, businessId);
      request.businessAccess = access;
      granted = new Set(access.permissions);
    } else if (agencyId) {
      const access = await this.accessService.getAgencyAccess(user.id, agencyId);
      granted = new Set(access.permissions);
    } else {
      granted = new Set(await this.accessService.getPlatformPermissions(user.id));
    }

    const allowed = required.every((permission) => granted.has(permission));

    if (!allowed) {
      throw new ForbiddenException('You do not have the required permissions');
    }

    return true;
  }
}
