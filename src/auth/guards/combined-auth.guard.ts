import { Injectable, ExecutionContext, UnauthorizedException, CanActivate } from '@nestjs/common';
import { AzureEasyAuthGuard } from './azure-easy-auth.guard';
import { JwtAuthGuard } from './jwt-auth.guard';

/**
 * Combined authentication guard that tries Azure Easy Auth first,
 * then falls back to JWT authentication
 */
@Injectable()
export class CombinedAuthGuard implements CanActivate {
  constructor(
    private azureEasyAuthGuard: AzureEasyAuthGuard,
    private jwtAuthGuard: JwtAuthGuard,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const hasAzureHeader = !!request.headers['x-ms-client-principal'];
    const hasJwtToken = !!request.headers['authorization']?.startsWith('Bearer ');

    // Try Azure Easy Auth first if header is present
    if (hasAzureHeader) {
      try {
        const azureResult = await this.azureEasyAuthGuard.canActivate(context);
        if (azureResult) {
          return true;
        }
      } catch (error) {
        // If Azure auth fails and no JWT, throw error
        if (!hasJwtToken) {
          throw error;
        }
        // Otherwise, fall through to JWT
      }
    }

    // Fall back to JWT authentication
    if (hasJwtToken) {
      try {
        const jwtResult = await this.jwtAuthGuard.canActivate(context);
        // Handle both boolean and Observable<boolean>
        if (typeof jwtResult === 'boolean') {
          return jwtResult;
        }
        // If it's an Observable, convert to Promise
        return new Promise<boolean>((resolve, reject) => {
          jwtResult.subscribe({
            next: (value) => resolve(value),
            error: (err) => reject(err),
          });
        });
      } catch (error) {
        // If both fail, throw error
        if (!hasAzureHeader) {
          throw error;
        }
        throw new UnauthorizedException('Authentication failed');
      }
    }

    // No authentication method available
    throw new UnauthorizedException('No authentication credentials provided');
  }
}

