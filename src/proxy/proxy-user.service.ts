import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// import Redis from 'ioredis'; // Commented out - will use Redis later
import axios, { AxiosInstance } from 'axios';

interface ProxyUser {
  email: string; // Admin users use email for login
  password: string;
  role: string;
}

interface CachedJWT {
  token: string;
  expiresAt: number; // Timestamp when token expires
}

@Injectable()
export class ProxyUserService {
  private readonly logger = new Logger(ProxyUserService.name);
  private strapiClient: AxiosInstance;
  private strapiUrl: string;
  // In-memory cache for JWTs (will replace with Redis later)
  private jwtCache: Map<string, CachedJWT> = new Map();
  // Role-based API Tokens for /api/* endpoints (created in Strapi Admin → Settings → API Tokens)
  private apiTokens: Map<string, string> = new Map([
    ['admin', process.env.STRAPI_API_TOKEN_ADMIN || ''],
    ['editor', process.env.STRAPI_API_TOKEN_EDITOR || ''],
    ['author', process.env.STRAPI_API_TOKEN_AUTHOR || ''],
    ['viewer', process.env.STRAPI_API_TOKEN_VIEWER || ''],
  ]);
  private proxyUsers: ProxyUser[] = [
    { email: process.env.STRAPI_SUPER_ADMIN_PROXY_EMAIL, password: process.env.STRAPI_SUPER_ADMIN_PROXY_PASSWORD, role: 'Super Admin' },

  ];

  constructor(
    private configService: ConfigService,
    // @Inject('REDIS_CLIENT') private redis: Redis, // Commented out - will use Redis later
  ) {
    this.strapiUrl = this.configService.get<string>('STRAPI_URL') || 'http://localhost:1337';
    this.strapiClient = axios.create({
      baseURL: this.strapiUrl,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }


  private async authenticateProxyUser(proxyUser: ProxyUser): Promise<string> {
    try {
      // Use /admin/login for admin users (Strapi Admin Panel)
      // This gives us admin JWT tokens for all Strapi API calls
      const response = await this.strapiClient.post('/admin/login', {
        email: proxyUser.email,
        password: proxyUser.password,
      });

      // Handle different response formats from Strapi admin login
      const token = response.data?.data?.token || response.data?.token;

      if (!token) {
        this.logger.error('Strapi admin login response:', JSON.stringify(response.data, null, 2));
        throw new Error('No JWT token received from Strapi admin login');
      }

      return token;
    } catch (error) {
      const errorMessage = error.response?.data?.error?.message
        || error.response?.data?.message
        || error.message;
      throw new Error(`Failed to authenticate proxy user ${proxyUser.email}: ${errorMessage}`);
    }
  }

  private async cacheProxyJWT(role: string, jwt: string) {
    // TODO: Replace with Redis later
    // const key = `proxy_jwt:${role}`;
    // // Cache for 6 days (Strapi JWTs typically expire in 7 days)
    // await this.redis.setex(key, 6 * 24 * 60 * 60, jwt);
    // In-memory cache for now (6 days expiration)
    const expiresAt = Date.now() + (6 * 24 * 60 * 60 * 1000);
    this.jwtCache.set(role, {
      token: jwt,
      expiresAt: expiresAt,
    });
    this.logger.log(`Cached JWT for role ${role} in memory (expires in 6 days)`);
  }

  async getProxyJWT(role: string): Promise<string> {
    // TODO: Replace with Redis later
    // const key = `proxy_jwt:${role}`;
    // let jwt: string | null = null;
    // 
    // // Check Redis for existing JWT
    // try {
    //   jwt = await this.redis.get(key);
    // } catch (error) {
    //   this.logger.warn(`Redis error when checking JWT for ${role}: ${error.message}. Will authenticate...`);
    // }

    // Check in-memory cache for existing JWT
    let jwt: string | null = null;
    const cached = this.jwtCache.get(role);

    if (cached) {
      // Check if token is still valid (not expired)
      if (Date.now() < cached.expiresAt) {
        jwt = cached.token;
        this.logger.debug(`Using cached JWT for role ${role}`);
      } else {
        // Token expired, remove from cache
        this.jwtCache.delete(role);
        this.logger.log(`Cached JWT for role ${role} expired, will re-authenticate`);
      }
    }

    // If JWT not found in cache, authenticate the proxy user and cache it
    if (!jwt) {
      this.logger.log(`JWT not found in cache for role ${role}, authenticating proxy user...`);
      const proxyUser = this.proxyUsers.find((u) => u.role === role);

      if (!proxyUser) {
        throw new Error(`Proxy user for role ${role} not found`);
      }

      try {
        jwt = await this.authenticateProxyUser(proxyUser);
        await this.cacheProxyJWT(role, jwt);
        this.logger.log(`✓ Authenticated and cached JWT for proxy user ${proxyUser.email} (${role})`);
      } catch (error) {
        throw new Error(`Failed to authenticate proxy user for role ${role}: ${error.message}`);
      }
    }

    return jwt;
  }

  /**
   * Get API token for a specific role
   * @param role - User role (admin, editor, author, viewer)
   * @returns API token for the role, or null if not configured
   */
  private getApiTokenForRole(role: string): string | null {
    // Map role to API token
    // Normalize role name (handle variations like 'super admin', 'Super Admin', etc.)
    let roleKey = role;

    // Handle role name variations
    if (role.toLowerCase() === 'super admin') {
      roleKey = 'admin';
    } else if (role.toLowerCase() === 'editor') {
      roleKey = 'editor';
    } else if (role.toLowerCase() === 'author') {
      roleKey = 'author';
    } else if (role.toLowerCase() === 'viewer') {
      roleKey = 'viewer';
    }


    const apiToken = this.apiTokens.get(roleKey);
    return apiToken && apiToken.trim() !== '' ? apiToken : null;
  }

  async forwardRequestToStrapi(
    method: string,
    url: string,
    data?: any,
    proxyRole: string = 'Viewer',
  ) {
    
    // For /api/* endpoints, use role-based API token if available
    // For /admin/* endpoints, use admin JWT token
    let authToken: string;

    if (url.includes('/api/')) {
      // Get role-based API token for /api/* endpoints
       authToken = this.getApiTokenForRole(proxyRole);
       this.logger.debug(`Using ${proxyRole} API token for ${url}`);
    } else {
      // Use admin JWT token for /admin/* endpoints
      authToken = await this.getProxyJWT(proxyRole);
      this.logger.debug(`Using admin JWT token for ${url}`);
    }

    // Build headers with proper content type for API requests
    const headers: any = {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    };

    // For Strapi 5.x API endpoints, might need additional headers
    // Some endpoints require specific headers for proper authentication
    if (url.includes('/api/')) {
      headers['Accept'] = 'application/json';
    }
    console.log('headers..........................', headers);

    const response = await this.strapiClient({
      method: method as any,
      url: url.startsWith('/') ? url : `/${url}`,
      data,
      headers,
    }).catch((error) => {
      // Log detailed error for debugging
      if (error.response) {
        this.logger.error(`Strapi API Error (${error.response.status}):`, {
          url: url,
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data,
          headers: error.response.headers,
        });
      } else {
        this.logger.error(`Strapi API Error:`, error.message);
      }
      throw error;
    });

    return response.data;
  }

  getStrapiUrl(): string {
    return this.strapiUrl;
  }
}
