import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContentAuditLog } from './entities/content-audit-log.entity';

export interface AuditLogData {
  contentId: string;
  action: 'created' | 'updated' | 'deleted';
  customUserId: string | null; // Can be null if user ID is not available
  contentType?: string | null; // Content type name (e.g., 'article', 'product')
  contentName?: string | null; // Content item name/title for display
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(ContentAuditLog)
    private auditLogRepository: Repository<ContentAuditLog>,
  ) {}

  /**
   * Log a content operation (create, update, delete)
   * IMPORTANT: This creates a NEW audit log entry. It does NOT delete or modify existing entries.
   * All audit logs (created, updated, deleted) are preserved in the database for complete history.
   * This method should not throw errors to avoid breaking the main operation.
   */
  async logOperation(data: AuditLogData): Promise<ContentAuditLog | null> {
    try {
      // Create a new audit log entry (INSERT operation, not UPDATE or DELETE)
      const auditLog = this.auditLogRepository.create({
        contentId: String(data.contentId),
        action: data.action,
        customUserId: data.customUserId,
        contentType: data.contentType || null,
        contentName: data.contentName || null,
      });

      // Save the new entry - this does NOT affect existing audit log entries
      const saved = await this.auditLogRepository.save(auditLog);
      this.logger.debug(`Audit log created: ${data.action} on content ${data.contentId} (${data.contentType}: ${data.contentName}) by user ${data.customUserId}`);
      
      return saved;
    } catch (error: any) {
      this.logger.error(`Failed to create audit log: ${error.message}`, error.stack);
      // Don't throw - audit logging should not break the main operation
      return null;
    }
  }

  /**
   * Get audit logs for a specific content item
   */
  async getContentAuditLogs(
    contentId: string,
    limit: number = 50,
  ): Promise<ContentAuditLog[]> {
    return this.auditLogRepository.find({
      where: {
        contentId: String(contentId),
      },
      order: {
        timestamp: 'DESC',
      },
      take: limit,
    });
  }

  /**
   * Get audit logs for a user
   */
  async getUserAuditLogs(
    customUserId: string,
    limit: number = 50,
  ): Promise<ContentAuditLog[]> {
    return this.auditLogRepository.find({
      where: {
        customUserId,
      },
      order: {
        timestamp: 'DESC',
      },
      take: limit,
    });
  }

  /**
   * Check if a user is the creator of a content item
   * Returns the customUserId of the creator, or null if not found
   */
  async getContentCreator(contentId: string): Promise<string | null> {
    try {
      // Find the first 'created' action for this content item (ordered by timestamp ASC)
      const creatorLog = await this.auditLogRepository.findOne({
        where: {
          contentId: String(contentId),
          action: 'created',
        },
        order: {
          timestamp: 'ASC', // Get the first creation entry
        },
      });

      return creatorLog?.customUserId || null;
    } catch (error: any) {
      this.logger.error(`Failed to get content creator: ${error.message}`, error.stack);
      return null;
    }
  }

  /**
   * Check if a user owns (created) a content item
   */
  async isContentOwner(contentId: string, customUserId: string): Promise<boolean> {
    if (!customUserId) {
      return false;
    }

    const creatorId = await this.getContentCreator(contentId);
    return creatorId === customUserId;
  }
}

