import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';

export interface AzureClientPrincipal {
  auth_typ?: string;
  name_typ?: string;
  role_typ?: string;
  claims?: Array<{
    typ: string;
    val: string;
  }>;
}

@Injectable()
export class AzureEasyAuthStrategy {
  private readonly logger = new Logger(AzureEasyAuthStrategy.name);

  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async validate(request: any): Promise<any> {
    const clientPrincipalHeader = request.headers['x-ms-client-principal'] as string;

    if (!clientPrincipalHeader) {
      // No Azure Easy Auth header, skip this strategy
      return null;
    }

    try {
      // Decode base64 header
      const decoded = Buffer.from(clientPrincipalHeader, 'base64').toString('utf-8');
      const clientPrincipal: AzureClientPrincipal = JSON.parse(decoded);

      this.logger.debug('Azure Easy Auth principal:', {
        authType: clientPrincipal.auth_typ,
        nameType: clientPrincipal.name_typ,
        claimsCount: clientPrincipal.claims?.length || 0,
      });

      // Extract user information from claims
      const claims = clientPrincipal.claims || [];
      const emailClaim = claims.find((c) => c.typ === 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress' || c.typ === 'email');
      const nameClaim = claims.find((c) => c.typ === 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name' || c.typ === 'name');
      const nameIdentifierClaim = claims.find((c) => c.typ === 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier' || c.typ === 'sub');
      const rolesClaim = claims.find((c) => c.typ === 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role' || c.typ === 'roles');

      const email = emailClaim?.val || nameClaim?.val || nameIdentifierClaim?.val;
      const authKey = nameIdentifierClaim?.val || email;
      const roles = rolesClaim?.val ? rolesClaim.val.split(',') : [];

      if (!email && !authKey) {
        this.logger.warn('Azure Easy Auth: No email or identifier found in claims');
        throw new UnauthorizedException('Invalid Azure Easy Auth principal: missing user identifier');
      }

      // Look up user in database by authKey or email
      let user = await this.usersRepository.findOne({
        where: [
          { authKey: authKey },
          { email: email },
        ],
      });

      // If user not found by authKey, try to find by email
      if (!user && email) {
        user = await this.usersRepository.findOne({
          where: { email: email },
        });
      }

      if (!user) {
        this.logger.warn(`Azure Easy Auth: User not found in database for authKey: ${authKey}, email: ${email}`);
        throw new UnauthorizedException('User not found in database');
      }

      // Check if user is blocked
      if (user.blocked) {
        this.logger.warn(`Azure Easy Auth: User ${user.id} is blocked`);
        throw new UnauthorizedException('Account is blocked');
      }

      // Update authKey if it's not set and we have a value
      if (!user.authKey && authKey) {
        user.authKey = authKey;
        await this.usersRepository.save(user);
        this.logger.log(`Updated authKey for user ${user.id}`);
      }

      // Determine role - use Azure role if available, otherwise use user's role
      let userRole = user.role || 'viewer';
      if (roles.length > 0) {
        // Map Azure roles to our roles
        const azureRole = roles[0].toLowerCase();
        if (azureRole.includes('admin') || azureRole.includes('administrator')) {
          userRole = 'admin';
        } else if (azureRole.includes('editor')) {
          userRole = 'editor';
        } else if (azureRole.includes('author')) {
          userRole = 'author';
        } else {
          userRole = 'viewer';
        }
      }

      this.logger.log(`Azure Easy Auth: Authenticated user ${user.email} (${user.id}) with role ${userRole}`);

      return {
        userId: user.id,
        email: user.email,
        username: user.username,
        role: userRole,
        authKey: user.authKey,
        authType: 'azure-easy-auth',
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error(`Azure Easy Auth validation error: ${error.message}`, error.stack);
      throw new UnauthorizedException('Failed to validate Azure Easy Auth principal');
    }
  }
}

