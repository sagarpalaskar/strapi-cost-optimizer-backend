import { Injectable, CanActivate, ExecutionContext, ForbiddenException, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../enums/user-role.enum';

export const ROLES_KEY = 'roles';

/**
 * Roles decorator to specify which roles can access an endpoint
 * Usage: @Roles('admin', 'editor', 'author')
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      // If no roles are specified, allow access
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const userRole = user?.role?.toLowerCase() || 'viewer';

    // Normalize role names for comparison
    const normalizedUserRole = this.normalizeRole(userRole);
    const normalizedRequiredRoles = requiredRoles.map(role => this.normalizeRole(role.toLowerCase()));

    const hasRole = normalizedRequiredRoles.includes(normalizedUserRole);

    if (!hasRole) {
      throw new ForbiddenException(
        `Access denied. Required roles: ${requiredRoles.join(', ')}. Your role: ${userRole}`
      );
    }

    return true;
  }

  /**
   * Normalize role names to handle variations
   */
  private normalizeRole(role: string): string {
    const roleMap: Record<string, string> = {
      'super admin': 'admin',
      'superadmin': 'admin',
      'viewer': 'viewer',
      'author': 'author',
      'editor': 'editor',
      'admin': 'admin',
    };

    return roleMap[role.toLowerCase()] || role.toLowerCase();
  }
}

