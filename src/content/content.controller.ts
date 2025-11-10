import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiBody } from '@nestjs/swagger';
import { ContentService } from './content.service';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';
import { CreateContentTypeDto } from './dto/create-content-type.dto';

@ApiTags('Content')
@ApiBearerAuth('JWT-auth')
@Controller('api')
@UseGuards(JwtAuthGuard)
export class ContentController {
  constructor(
    private readonly contentService: ContentService,
    private readonly auditService: AuditService,
  ) {}

  @Get('content-types')
  @ApiOperation({ summary: 'Get all content types' })
  @ApiResponse({ status: 200, description: 'List of content types' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getContentTypes(@Request() req) {
    console.log(`[ContentController] GET ${req.url || '/api/content-types'}`);
    const userRole = req.user?.role || 'viewer';
    const contentTypes = await this.contentService.getContentTypes(userRole);
    console.log('contentTypes.........................++++.',contentTypes);
    
    return { data: contentTypes };
  }

  @Get('content-types/:slug')
  @ApiOperation({ summary: 'Get specific content type by slug' })
  @ApiParam({ name: 'slug', description: 'Content type slug (e.g., articles, products)' })
  @ApiResponse({ status: 200, description: 'Content type details' })
  @ApiResponse({ status: 404, description: 'Content type not found' })
  async getContentType(@Param('slug') slug: string, @Request() req) {
    console.log(`[ContentController] GET ${req.url || `/api/content-types/${slug}`}`);
    const userRole = req.user?.role || 'viewer';
    const contentType = await this.contentService.getContentType(slug, userRole);
    return { data: contentType };
  }

  @Post('content-types')
  @Roles('admin', 'editor', 'author')
  @ApiOperation({ summary: 'Create a new content type' })
  @ApiBody({ type: CreateContentTypeDto })
  @ApiResponse({ status: 201, description: 'Content type created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - validation failed' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  @ApiResponse({ status: 409, description: 'Content type already exists' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createContentType(@Body() createDto: CreateContentTypeDto, @Request() req) {
    console.log(`[ContentController] POST ${req.url || '/api/content-types'}`);
    const userRole = req.user?.role || 'viewer';
    const contentType = await this.contentService.createContentType(createDto, userRole);
    return { data: contentType };
  }

  // Specific routes must come before catch-all routes
  // Exclude 'dashboard', 'auth', 'api-docs', 'health' from content type matching
  @Get(':contentType')
  @ApiOperation({ summary: 'Get all items of a content type' })
  @ApiParam({ name: 'contentType', description: 'Content type name (e.g., articles)' })
  @ApiResponse({ status: 200, description: 'List of content items' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Content type not found' })
  async getContentItems(
    @Param('contentType') contentType: string,
    @Query() params: any,
    @Request() req,
  ) {
    console.log(`[ContentController] GET ${req.url || `/api/${contentType}`}`);
    
    // Exclude reserved paths from being treated as content types
    const reservedPaths = ['dashboard', 'auth', 'api-docs', 'health', 'swagger'];
    if (reservedPaths.includes(contentType)) {
      throw new NotFoundException(`Path '/api/${contentType}' not found`);
    }
    
    const userRole = req.user?.role || 'viewer';
    return this.contentService.getContentItems(contentType, params, userRole);
  }

  @Get(':contentType/:id')
  @ApiOperation({ summary: 'Get specific content item by ID' })
  @ApiParam({ name: 'contentType', description: 'Content type name' })
  @ApiParam({ name: 'id', description: 'Content item ID' })
  @ApiResponse({ status: 200, description: 'Content item details' })
  @ApiResponse({ status: 404, description: 'Content item not found' })
  async getContentItem(
    @Param('contentType') contentType: string,
    @Param('id') id: string,
    @Request() req,
  ) {
    console.log(`[ContentController] GET ${req.url || `/api/${contentType}/${id}`}`);
    
    // Exclude reserved paths
    const reservedPaths = ['dashboard', 'auth', 'api-docs', 'health', 'swagger'];
    if (reservedPaths.includes(contentType)) {
      throw new NotFoundException(`Path '/api/${contentType}/${id}' not found`);
    }
    
    const userRole = req.user?.role || 'viewer';
    return this.contentService.getContentItem(contentType, id, userRole);
  }

  @Post(':contentType')
  @Roles('admin', 'editor', 'author')
  @ApiOperation({ summary: 'Create new content item' })
  @ApiParam({ name: 'contentType', description: 'Content type name' })
  @ApiResponse({ status: 201, description: 'Content item created successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Viewer role cannot create content' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createContentItem(
    @Param('contentType') contentType: string,
    @Body() data: any,
    @Request() req,
  ) {
    console.log(`[ContentController] POST ${req.url || `/api/${contentType}`}`);
    
    // Exclude reserved paths
    const reservedPaths = ['dashboard', 'auth', 'api-docs', 'health', 'swagger'];
    if (reservedPaths.includes(contentType)) {
      throw new NotFoundException(`Path '/api/${contentType}' not found`);
    }
    console.log('req.user..........................', req.user);
    const userRole = req.user?.role || 'viewer';
    const customUserId = req.user?.userId; // Get custom user ID from JWT token
    
    // Create content item
    const response = await this.contentService.createContentItem(contentType, data, userRole);
    
    // Log audit trail (async, don't wait - non-blocking)
    if (response?.data) {
      // Use documentId if available (Strapi 5.x), otherwise use numeric id
      const contentId = response.data.documentId || response.data.id;
      // Extract content name/title from response
      const contentName = response.data.title || response.data.name || response.data.heading || response.data.label || null;
      
      this.auditService.logOperation({
        contentId: String(contentId),
        action: 'created',
        customUserId: customUserId || null,
        contentType: contentType,
        contentName: contentName,
      }).catch(err => {
        console.error('Failed to log audit trail for create:', err);
      });
    }
    
    return response;
  }

  @Put(':contentType/:id')
  @Roles('admin', 'editor', 'author')
  @ApiOperation({ summary: 'Update content item' })
  @ApiParam({ name: 'contentType', description: 'Content type name' })
  @ApiParam({ name: 'id', description: 'Content item ID' })
  @ApiResponse({ status: 200, description: 'Content item updated successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Viewer role cannot update content or Author cannot update others\' content' })
  @ApiResponse({ status: 404, description: 'Content item not found' })
  async updateContentItem(
    @Param('contentType') contentType: string,
    @Param('id') id: string,
    @Body() data: any,
    @Request() req,
  ) {
    console.log(`[ContentController] PUT ${req.url || `/api/${contentType}/${id}`}`);
    
    // Exclude reserved paths
    const reservedPaths = ['dashboard', 'auth', 'api-docs', 'health', 'swagger'];
    if (reservedPaths.includes(contentType)) {
      throw new NotFoundException(`Path '/api/${contentType}/${id}' not found`);
    }
    
    const userRole = req.user?.role || 'viewer';
    const customUserId = req.user?.userId; // Get custom user ID from JWT token
    
    // For author role, check if user owns this content
    if (userRole.toLowerCase() === 'author' && customUserId) {
      // Get content item to find documentId or id for audit log lookup
      let contentIdForCheck = id;
      try {
        const existingItem = await this.contentService.getContentItem(contentType, id, userRole);
        contentIdForCheck = existingItem?.data?.documentId || existingItem?.data?.id || id;
      } catch (err) {
        // If we can't get the item, use the id parameter
        console.warn(`Could not get content item for ownership check, using id parameter: ${err}`);
      }
      
      // Check ownership via audit log
      const isOwner = await this.auditService.isContentOwner(String(contentIdForCheck), customUserId);
      if (!isOwner) {
        throw new ForbiddenException('You can only update your own content');
      }
    }
    
    // Update content item
    const response = await this.contentService.updateContentItem(contentType, id, data, userRole);
    
    // Log audit trail (async, don't wait - non-blocking)
    // Try to get documentId from response if available, otherwise use the id parameter
    const contentId = response?.data?.documentId || id;
    // Extract content name/title from response (use updated data if available, otherwise from response)
    const contentName = response?.data?.title || 
                       response?.data?.name || 
                       response?.data?.heading || 
                       response?.data?.label ||
                       data?.title || 
                       data?.name || 
                       null;
    
    this.auditService.logOperation({
      contentId: String(contentId),
      action: 'updated',
      customUserId: customUserId || null,
      contentType: contentType,
      contentName: contentName,
    }).catch(err => {
      console.error('Failed to log audit trail for update:', err);
    });
    
    return response;
  }

  @Delete(':contentType/:id')
  @Roles('admin', 'author')
  @ApiOperation({ summary: 'Delete content item (admin or author for own content)' })
  @ApiParam({ name: 'contentType', description: 'Content type name' })
  @ApiParam({ name: 'id', description: 'Content item ID' })
  @ApiResponse({ status: 200, description: 'Content item deleted successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Only admin can delete any content, authors can only delete their own' })
  @ApiResponse({ status: 404, description: 'Content item not found' })
  async deleteContentItem(
    @Param('contentType') contentType: string,
    @Param('id') id: string,
    @Request() req,
  ) {
    console.log(`[ContentController] DELETE ${req.url || `/api/${contentType}/${id}`}`);
    
    // Exclude reserved paths
    const reservedPaths = ['dashboard', 'auth', 'api-docs', 'health', 'swagger'];
    if (reservedPaths.includes(contentType)) {
      throw new NotFoundException(`Path '/api/${contentType}/${id}' not found`);
    }
    
    const userRole = req.user?.role || 'viewer';
    const customUserId = req.user?.userId; // Get custom user ID from JWT token
    
    // Get content item info before deletion to ensure we have the correct contentId (documentId if available)
    let contentIdForAudit = id;
    let contentNameForAudit = null;
    try {
      const itemBeforeDelete = await this.contentService.getContentItem(contentType, id, userRole);
      if (itemBeforeDelete?.data?.documentId) {
        contentIdForAudit = itemBeforeDelete.data.documentId;
      } else if (itemBeforeDelete?.data?.id) {
        contentIdForAudit = String(itemBeforeDelete.data.id);
      }
      // Extract content name/title before deletion
      if (itemBeforeDelete?.data) {
        contentNameForAudit = itemBeforeDelete.data.title || 
                             itemBeforeDelete.data.name || 
                             itemBeforeDelete.data.heading || 
                             itemBeforeDelete.data.label || 
                             null;
      }
      
      // For author role, check if user owns this content
      if (userRole.toLowerCase() === 'author' && customUserId) {
        const isOwner = await this.auditService.isContentOwner(String(contentIdForAudit), customUserId);
        if (!isOwner) {
          throw new ForbiddenException('You can only delete your own content');
        }
      }
    } catch (err) {
      // If it's a ForbiddenException, re-throw it
      if (err instanceof ForbiddenException) {
        throw err;
      }
      // If we can't get the item, use the id parameter
      console.warn(`Could not get content item before delete for audit log, using id parameter: ${err}`);
    }
    
    // Delete content item from Strapi
    await this.contentService.deleteContentItem(contentType, id, userRole);
    
    // IMPORTANT: Create a new audit log entry with action='deleted'
    // This does NOT delete existing audit logs (created/updated entries remain intact)
    // The audit log table maintains a complete history of all operations
    this.auditService.logOperation({
      contentId: String(contentIdForAudit),
      action: 'deleted',
      customUserId: customUserId || null,
      contentType: contentType,
      contentName: contentNameForAudit,
    }).catch(err => {
      console.error('Failed to log audit trail for delete:', err);
    });
    
    return { success: true };
  }

  @Post(':contentType/duplicate/:id')
  @Roles('admin', 'editor', 'author')
  @ApiOperation({ summary: 'Duplicate content item' })
  @ApiParam({ name: 'contentType', description: 'Content type name' })
  @ApiParam({ name: 'id', description: 'Content item ID to duplicate' })
  @ApiResponse({ status: 201, description: 'Content item duplicated successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Author cannot duplicate others\' content' })
  @ApiResponse({ status: 404, description: 'Content item not found' })
  async duplicateContentItem(
    @Param('contentType') contentType: string,
    @Param('id') id: string,
    @Request() req,
  ) {
    console.log(`[ContentController] POST ${req.url || `/api/${contentType}/duplicate/${id}`}`);
    
    // Exclude reserved paths
    const reservedPaths = ['dashboard', 'auth', 'api-docs', 'health', 'swagger'];
    if (reservedPaths.includes(contentType)) {
      throw new NotFoundException(`Path '/api/${contentType}/duplicate/${id}' not found`);
    }
    
    const userRole = req.user?.role || 'viewer';
    const customUserId = req.user?.userId;
    
    // For author role, check if user owns this content
    if (userRole.toLowerCase() === 'author' && customUserId) {
      // Get original content item to find documentId or id for audit log lookup
      let contentIdForCheck = id;
      try {
        const original = await this.contentService.getContentItem(contentType, id, userRole);
        contentIdForCheck = original?.data?.documentId || original?.data?.id || id;
      } catch (err) {
        console.warn(`Could not get content item for ownership check, using id parameter: ${err}`);
      }
      
      // Check ownership via audit log
      const isOwner = await this.auditService.isContentOwner(String(contentIdForCheck), customUserId);
      if (!isOwner) {
        throw new ForbiddenException('You can only duplicate your own content');
      }
    }
    
    return this.contentService.duplicateContentItem(contentType, id, userRole);
  }

  @Get(':contentType/:id/ownership')
  @ApiOperation({ summary: 'Check content ownership (for frontend)' })
  @ApiParam({ name: 'contentType', description: 'Content type name' })
  @ApiParam({ name: 'id', description: 'Content item ID' })
  @ApiResponse({ status: 200, description: 'Ownership check result' })
  @ApiResponse({ status: 404, description: 'Content item not found' })
  async checkContentOwnership(
    @Param('contentType') contentType: string,
    @Param('id') id: string,
    @Request() req,
  ) {
    console.log(`[ContentController] GET ${req.url || `/api/${contentType}/${id}/ownership`}`);
    
    // Exclude reserved paths
    const reservedPaths = ['dashboard', 'auth', 'api-docs', 'health', 'swagger'];
    if (reservedPaths.includes(contentType)) {
      throw new NotFoundException(`Path '/api/${contentType}/${id}/ownership' not found`);
    }
    
    const userRole = req.user?.role || 'viewer';
    const customUserId = req.user?.userId;
    
    // Get content item to find documentId or id for audit log lookup
    let contentIdForCheck = id;
    try {
      const existingItem = await this.contentService.getContentItem(contentType, id, userRole);
      contentIdForCheck = existingItem?.data?.documentId || existingItem?.data?.id || id;
    } catch (err) {
      // If we can't get the item, use the id parameter
      console.warn(`Could not get content item for ownership check, using id parameter: ${err}`);
    }
    
    // Check ownership via audit log
    let isOwner = false;
    if (customUserId) {
      isOwner = await this.auditService.isContentOwner(String(contentIdForCheck), customUserId);
    }
    
    // Get creator info
    const creatorId = await this.auditService.getContentCreator(String(contentIdForCheck));
    
    return {
      isOwner,
      creatorId,
      currentUserId: customUserId || null,
      canEdit: userRole.toLowerCase() === 'admin' || 
               userRole.toLowerCase() === 'editor' || 
               (userRole.toLowerCase() === 'author' && isOwner),
    };
  }
}

