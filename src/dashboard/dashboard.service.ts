import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { ProxyUserService } from '../proxy/proxy-user.service';
import { ContentService } from '../content/content.service';
import { AuditService } from '../content/audit.service';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private proxyUserService: ProxyUserService,
    private contentService: ContentService,
    private auditService: AuditService,
  ) { }

  async getStats(userRole: string) {
    // Calculate previous period (24 hours ago)
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Get content types from Strapi
    const contentTypes = await this.contentService.getContentTypes(userRole);
    const contentTypesCount = contentTypes.length;

    // Count previous content types (created before yesterday)
    const previousContentTypesCount = contentTypes.filter(
      (ct: any) => new Date(ct.createdAt) < yesterday
    ).length;

    // Get total entries count from Strapi
    let totalEntries = 0;
    let previousTotalEntries = 0;
    console.log('####get stats content types', contentTypes.map(ct => ct.name));

    // Filter out content types that might not have valid API endpoints
    // Skip plugin types, system types, or invalid content types
    const validContentTypes = contentTypes.filter((ct: any) => {
      // Skip if name is empty or invalid
      if (!ct.name || typeof ct.name !== 'string') {
        return false;
      }

      // Check the id/uid field to identify plugin types
      // Plugin types have UIDs like: "plugin::users-permissions.user" or "plugin::upload.file"
      const id = ct.id || ct.uid || '';
      if (id.includes('plugin::')) {
        console.log(`Skipping plugin content type: ${ct.name} (id: ${id})`);
        return false;
      }

      // Only include content types that start with "api::" (user-created content types)
      // This ensures we only count actual content types, not plugin/system types
      if (!id.includes('api::')) {
        console.log(`Skipping non-api content type: ${ct.name} (id: ${id})`);
        return false;
      }

      return true;
    });

    console.log(`Valid content types for entries count: ${validContentTypes.map(ct => ct.name).join(', ')}`);

    // Get entries count for each valid content type
    for (const contentType of validContentTypes) {
      try {
        // Use pluralName from content type schema (e.g., "studies" not "studys")
        const pluralName = contentType.pluralName || `${contentType.name}s`; // Fallback to adding 's' if pluralName not available
        const response = await this.proxyUserService.forwardRequestToStrapi(
          'GET',
          `/api/${pluralName}?pagination[limit]=1`,
          undefined,
          userRole,
        );
        if (response?.meta?.pagination?.total) {
          totalEntries += response.meta.pagination.total;
        }
      } catch (error: any) {
        // Log warning but don't fail the entire stats request
        // Some content types might not have valid API endpoints (e.g., plugin types, single types)
        console.warn(`Failed to get entries count for content type "${contentType.name}":`, error.message);
        // Continue with other content types instead of throwing
        // This allows the dashboard to show stats for valid content types even if some fail
      }
    }
    console.log('####get stats content entries', totalEntries)

    // Note: Previous period entries calculation would require historical data
    // For now, we'll set it to 0 as we don't have historical tracking
    previousTotalEntries = 0;

    // Get users count from database (users are stored in our DB)
    const usersCount = await this.usersRepository.count();
    console.log('####usersCount', usersCount)

    const previousUsersCount = await this.usersRepository
      .createQueryBuilder('user')
      .where('user.createdAt < :yesterday', { yesterday })
      .getCount();
    console.log('####previousUsersCount', previousUsersCount)

    // Calculate change percentages
    const contentTypesChange = this.calculateChange(
      contentTypesCount,
      previousContentTypesCount,
      false,
    );
    const entriesChange = this.calculateChange(
      totalEntries,
      previousTotalEntries,
      true,
    );
    const usersChange = this.calculateChange(
      usersCount,
      previousUsersCount,
      false,
    );

    return {
      contentTypes: {
        value: contentTypesCount,
        change: contentTypesChange.value,
        changeType: contentTypesChange.type,
      },
      entries: {
        value: totalEntries,
        change: entriesChange.value,
        changeType: entriesChange.type,
      },
      users: {
        value: usersCount,
        change: usersChange.value,
        changeType: usersChange.type,
      },
    };
  }

  /**
   * Calculate percentage change between current and previous values
   * @param current Current value
   * @param previous Previous value (from 24 hours ago)
   * @param showPercentage Whether to show percentage (true) or absolute change (false)
   * @returns Object with formatted change string and change type
   */
  private calculateChange(
    current: number,
    previous: number,
    showPercentage: boolean = true,
  ): { value: string; type: 'positive' | 'negative' | 'neutral' } {
    // If no previous data, return neutral
    if (previous === 0) {
      if (current === 0) {
        return { value: showPercentage ? '0%' : '0', type: 'neutral' };
      }
      // If current > 0 but previous was 0, it's a new addition (100% increase)
      return { value: showPercentage ? '+100%' : `+${current}`, type: 'positive' };
    }

    const difference = current - previous;
    const percentageChange = (difference / previous) * 100;

    // Round to 1 decimal place
    const roundedChange = Math.round(percentageChange * 10) / 10;

    if (roundedChange === 0) {
      return { value: showPercentage ? '0%' : '0', type: 'neutral' };
    }

    const sign = roundedChange > 0 ? '+' : '';
    const formattedValue = showPercentage
      ? `${sign}${roundedChange}%`
      : `${sign}${difference}`;

    return {
      value: formattedValue,
      type: roundedChange > 0 ? 'positive' : 'negative',
    };
  }

  async getRecentActivity(userRole: string, customUserId: string | null, limit: number = 10) {
    const activities: any[] = [];

    // If no customUserId provided, return empty array (or show all activity for admin/editor)
    if (!customUserId) {
      this.logger.warn('getRecentActivity called without customUserId');
      return [];
    }

    // Step 1: Query audit log first - get user's recent activity
    const auditLogs = await this.auditService.getUserAuditLogs(customUserId, limit * 2); // Get more to account for failed fetches

    if (auditLogs.length === 0) {
      this.logger.debug(`No audit logs found for user ${customUserId}`);
      return [];
    }

    this.logger.debug(`Found ${auditLogs.length} audit log entries for user ${customUserId}`);

    // Step 2: Get content types map for display names (only if needed for fallback)
    const contentTypes = await this.contentService.getContentTypes(userRole);
    const contentTypeMap = new Map<string, string>();
    contentTypes.forEach((ct: any) => {
      if (ct.name && ct.displayName) {
        contentTypeMap.set(ct.name, ct.displayName);
      }
    });

    // Step 3: For each audit log entry, use stored data from audit log
    // No need to fetch from Strapi since we now store contentType and contentName
    const activityPromises = auditLogs.map(async (log) => {
      try {
        // Use stored data from audit log
        const contentTypeName = log.contentType || 'Unknown';
        const contentTypeDisplayName = contentTypeMap.get(contentTypeName) || contentTypeName;
        const contentName = log.contentName || `Content ${log.contentId}`;
        const actionText = this.getActionText(log.action, contentTypeName);

        return {
          id: log.id, // Use audit log entry's unique ID, not contentId (which can be duplicated)
          type: 'content',
          action: actionText,
          contentType: contentTypeDisplayName,
          item: contentName,
          time: log.timestamp,
          timestamp: log.timestamp,
          createdAt: null, // Not stored in audit log, can fetch if needed
          updatedAt: null, // Not stored in audit log, can fetch if needed
          contentId: log.contentId,
          customUserId: log.customUserId,
        };
      } catch (error: any) {
        this.logger.warn(`Failed to process audit log entry ${log.id}:`, error.message);
        // Return minimal activity entry from audit log
        const actionText = this.getActionText(log.action, log.contentType || 'item');
        return {
          id: log.id, // Use audit log entry's unique ID, not contentId (which can be duplicated)
          type: 'content',
          action: actionText,
          contentType: log.contentType || 'Unknown',
          item: log.contentName || `Content ${log.contentId}`,
          time: log.timestamp,
          timestamp: log.timestamp,
          createdAt: null,
          updatedAt: null,
          contentId: log.contentId,
          customUserId: log.customUserId,
          error: true,
        };
      }
    });

    // Wait for all promises to settle (both success and failure)
    const results = await Promise.allSettled(activityPromises);

    // Extract successful results
    results.forEach((result) => {
      if (result.status === 'fulfilled' && result.value) {
        activities.push(result.value);
      }
    });

    // Sort by timestamp descending (most recent first)
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Format time as "X minutes/hours/days ago" and limit results
    return activities.slice(0, limit).map((activity) => ({
      ...activity,
      time: this.formatTimeAgo(activity.timestamp),
    }));
  }

  /**
   * Get human-readable action text
   */
  private getActionText(action: string, contentType: string): string {
    const contentTypeDisplay = contentType === 'articles' ? 'article' : 
                               contentType === 'products' ? 'product' : 
                               contentType.toLowerCase();
    
    switch (action.toLowerCase()) {
      case 'created':
        return `Created new ${contentTypeDisplay}`;
      case 'updated':
        return `Updated ${contentTypeDisplay}`;
      case 'deleted':
        return `Deleted ${contentTypeDisplay}`;
      default:
        return `${action} ${contentTypeDisplay}`;
    }
  }

  private formatTimeAgo(date: string | Date): string {
    const now = new Date();
    const past = new Date(date);
    const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);

    if (diffInSeconds < 60) {
      return `${diffInSeconds} seconds ago`;
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
    } else {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days} ${days === 1 ? 'day' : 'days'} ago`;
    }
  }
}
