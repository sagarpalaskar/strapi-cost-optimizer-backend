import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';

export interface SessionData {
  userId: string;
  email: string;
  username: string;
  role: string;
  authKey?: string;
  authType: 'jwt' | 'azure-easy-auth';
  createdAt: Date;
  lastAccessedAt: Date;
}

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);
  // In-memory session store (can be replaced with Redis or database)
  private sessions: Map<string, SessionData> = new Map();

  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  /**
   * Create a new session
   */
  createSession(userData: {
    userId: string;
    email: string;
    username: string;
    role: string;
    authKey?: string;
    authType: 'jwt' | 'azure-easy-auth';
  }): string {
    const sessionId = this.generateSessionId();
    const now = new Date();

    const session: SessionData = {
      ...userData,
      createdAt: now,
      lastAccessedAt: now,
    };

    this.sessions.set(sessionId, session);
    this.logger.debug(`Session created: ${sessionId} for user ${userData.email}`);

    return sessionId;
  }

  /**
   * Get session data
   */
  getSession(sessionId: string): SessionData | null {
    const session = this.sessions.get(sessionId);
    if (session) {
      // Update last accessed time
      session.lastAccessedAt = new Date();
      this.sessions.set(sessionId, session);
    }
    return session || null;
  }

  /**
   * Validate session and return user data
   */
  async validateSession(sessionId: string): Promise<SessionData | null> {
    const session = this.getSession(sessionId);
    if (!session) {
      return null;
    }

    // Verify user still exists and is not blocked
    const user = await this.usersRepository.findOne({
      where: { id: session.userId },
    });

    if (!user || user.blocked) {
      this.destroySession(sessionId);
      return null;
    }

    // Update session with latest user data
    session.role = user.role;
    this.sessions.set(sessionId, session);

    return session;
  }

  /**
   * Destroy a session
   */
  destroySession(sessionId: string): boolean {
    const deleted = this.sessions.delete(sessionId);
    if (deleted) {
      this.logger.debug(`Session destroyed: ${sessionId}`);
    }
    return deleted;
  }

  /**
   * Get all active sessions for a user
   */
  getUserSessions(userId: string): SessionData[] {
    return Array.from(this.sessions.values()).filter((s) => s.userId === userId);
  }

  /**
   * Destroy all sessions for a user
   */
  destroyUserSessions(userId: string): number {
    const userSessions = this.getUserSessions(userId);
    userSessions.forEach((session) => {
      const sessionId = Array.from(this.sessions.entries())
        .find(([_, s]) => s.userId === userId)?.[0];
      if (sessionId) {
        this.sessions.delete(sessionId);
      }
    });
    this.logger.log(`Destroyed ${userSessions.length} sessions for user ${userId}`);
    return userSessions.length;
  }

  /**
   * Clean up expired sessions (older than 24 hours of inactivity)
   */
  cleanupExpiredSessions(): number {
    const now = new Date();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    let cleaned = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      const age = now.getTime() - session.lastAccessedAt.getTime();
      if (age > maxAge) {
        this.sessions.delete(sessionId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.log(`Cleaned up ${cleaned} expired sessions`);
    }

    return cleaned;
  }

  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Get session statistics
   */
  getSessionStats(): {
    totalSessions: number;
    activeUsers: number;
  } {
    const uniqueUsers = new Set(Array.from(this.sessions.values()).map((s) => s.userId));
    return {
      totalSessions: this.sessions.size,
      activeUsers: uniqueUsers.size,
    };
  }
}

