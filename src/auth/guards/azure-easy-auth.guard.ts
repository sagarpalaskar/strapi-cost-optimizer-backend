import { Injectable, ExecutionContext, UnauthorizedException, CanActivate } from '@nestjs/common';
import { AzureEasyAuthStrategy } from '../strategies/azure-easy-auth.strategy';
import { SessionService } from '../services/session.service';

@Injectable()
export class AzureEasyAuthGuard implements CanActivate {
  constructor(
    private azureEasyAuthStrategy: AzureEasyAuthStrategy,
    private sessionService: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const hasAzureHeader = !!request.headers['x-ms-client-principal'];

    // Only activate if Azure Easy Auth header is present
    if (!hasAzureHeader) {
      // Return false to skip this guard (will fall through to next guard)
      return false;
    }

    try {
      const user = await this.azureEasyAuthStrategy.validate(request);
      if (user) {
        // Create session for Azure Easy Auth user
        const sessionId = this.sessionService.createSession({
          userId: user.userId,
          email: user.email,
          username: user.username,
          role: user.role,
          authKey: user.authKey,
          authType: 'azure-easy-auth',
        });
        
        request.user = user;
        request.sessionId = sessionId;
        return true;
      }
      throw new UnauthorizedException('Azure Easy Auth authentication failed');
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Azure Easy Auth validation error');
    }
  }
}

