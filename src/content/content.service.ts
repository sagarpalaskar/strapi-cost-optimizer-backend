import { Injectable, NotFoundException, BadRequestException, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ProxyUserService } from '../proxy/proxy-user.service';
import { CreateContentTypeDto } from './dto/create-content-type.dto';

@Injectable()
export class ContentService {
  private readonly logger = new Logger(ContentService.name);
  private contentTypesCache: Map<string, { singularName: string; pluralName: string }> = new Map();

  constructor(
    private proxyUserService: ProxyUserService,
  ) { }

  /**
   * Extract error message and status code from Strapi error response
   * Preserves original Strapi error messages and status codes
   */
  private extractStrapiError(error: any): { message: string; statusCode: number } {
    if (error.response) {
      const statusCode = error.response.status || HttpStatus.INTERNAL_SERVER_ERROR;
      const errorData = error.response.data;
      
      // Try to extract error message from various Strapi error formats
      let message = 'An error occurred while processing your request';
      
      if (errorData?.error?.message) {
        message = errorData.error.message;
      } else if (errorData?.message) {
        message = errorData.message;
      } else if (errorData?.error) {
        message = typeof errorData.error === 'string' ? errorData.error : JSON.stringify(errorData.error);
      } else if (errorData?.data?.error?.message) {
        message = errorData.data.error.message;
      } else if (errorData?.data?.message) {
        message = errorData.data.message;
      } else if (typeof errorData === 'string') {
        message = errorData;
      } else if (error.response.statusText) {
        message = error.response.statusText;
      }
      
      return { message, statusCode };
    } else if (error.message) {
      return { message: error.message, statusCode: HttpStatus.INTERNAL_SERVER_ERROR };
    } else {
      return { message: 'An unexpected error occurred', statusCode: HttpStatus.INTERNAL_SERVER_ERROR };
    }
  }

  /**
   * Wrap Strapi errors in HttpException to preserve status codes and messages
   */
  private handleStrapiError(error: any, context?: string): never {
    const { message, statusCode } = this.extractStrapiError(error);
    const errorMessage = context ? `${context}: ${message}` : message;
    throw new HttpException(errorMessage, statusCode);
  }

  /**
   * Get plural name for a content type
   * Looks up content type by name, singularName, or pluralName and returns the pluralName from Strapi's schema
   * Never adds 's' - only uses Strapi's pluralName
   */
  private async getPluralName(contentTypeParam: string, userRole: string): Promise<string> {
    const paramLower = contentTypeParam.toLowerCase();
    
    // Check cache first
    const cached = this.contentTypesCache.get(paramLower);
    if (cached && cached.pluralName) {
      return cached.pluralName;
    }

    try {
      // Fetch all content types to find the matching one
      const contentTypes = await this.getContentTypes(userRole);
      
      // Try to find match by name, singularName, or pluralName
      const matched = contentTypes.find((ct: any) => {
        return ct.name?.toLowerCase() === paramLower ||
               ct.singularName?.toLowerCase() === paramLower ||
               ct.pluralName?.toLowerCase() === paramLower;
      });

      if (matched) {
        const singular = matched.singularName || matched.name;
        const plural = matched.pluralName;
        
        // If pluralName is missing, throw error - we should never add 's' as fallback
        if (!plural) {
          throw new Error(`Content type '${singular}' is missing pluralName in Strapi schema. Please configure pluralName in Strapi content type builder.`);
        }
        
        // Cache by all possible keys for future lookups
        if (singular) {
          this.contentTypesCache.set(singular.toLowerCase(), { singularName: singular, pluralName: plural });
        }
        if (plural) {
          this.contentTypesCache.set(plural.toLowerCase(), { singularName: singular, pluralName: plural });
        }
        if (matched.name) {
          this.contentTypesCache.set(matched.name.toLowerCase(), { singularName: singular, pluralName: plural });
        }
        
        return plural;
      }
    } catch (error) {
      this.logger.warn(`Failed to get plural name for ${contentTypeParam}: ${error}`);
    }

    // No fallback - if pluralName is not found, throw error
    // This ensures we never add 's' incorrectly
    throw new Error(`Content type '${contentTypeParam}' not found in Strapi. Please ensure the content type exists and has a pluralName configured.`);
  }

  async getContentTypes(userRole: string): Promise<any[]> {
    try {
      // Directly call Strapi - throw error if fails
      // Use /api/* endpoint first (works with API tokens from Settings → API Tokens)
      // If it fails, throw error (no fallback)
      const response = await this.proxyUserService.forwardRequestToStrapi(
        'GET',
        '/api/content-type-builder/content-types',
        undefined,
        userRole,
      );

      // Transform Strapi response to our format
    // Strapi 5.x content-type-builder returns data in different format
    // Response might be: { data: [...] } or direct array
    let contentTypesArray = [];
    console.log('getContentTypes response..........................');
    if (Array.isArray(response?.data)) {
      console.log('response is array..........................');

      contentTypesArray = response.data;
    } else if (response?.data?.data && Array.isArray(response.data.data)) {
      contentTypesArray = response.data.data;
    } else if (Array.isArray(response)) {
      contentTypesArray = response;
    } else {
      this.logger.warn('Unexpected response format from Strapi content-type-builder:', JSON.stringify(response).substring(0, 200));
      return [];
    }

    // Filter content types:
    // 1. Include both collectionType and singleType
    // 2. Only visible !== false (exclude hidden content types like plugin::upload.file)
    // This filters out plugin types and system types that have visible: false
    const filteredContentTypes = contentTypesArray.filter((strapiType: any) => {
      const schema = strapiType.schema || strapiType;
      const kind = schema?.kind || strapiType.kind;
      const visible = schema?.visible !== undefined ? schema.visible : true; // Default to true if not set

      // Include both collectionType and singleType, but exclude hidden ones (visible !== false)
      // This excludes plugin types like plugin::upload.file which have visible: false
      return (kind === 'collectionType' || kind === 'singleType') && visible !== false;
    });
    console.log('filteredContentTypes..........................');

    try {
      const mappedContentTypes = filteredContentTypes.map((strapiType: any, index: number) => {
        try {
          console.log(`Mapping content type ${index}:`);

          // Handle different response formats from content-type-builder
          const schema = strapiType?.schema || strapiType;
          const uid = strapiType?.uid || schema?.uid || strapiType?.apiID;
          const apiID = strapiType?.apiID || schema?.apiID;

          // Extract apiID from uid if not directly available
          let finalApiID = apiID;
          if (!finalApiID && uid && typeof uid === 'string') {
            // Handle formats like: "api::article.article" or "plugin::upload.file"
            const uidParts = uid.split('::');
            if (uidParts.length > 1) {
              const afterDoubleColon = uidParts[1];
              const dotIndex = afterDoubleColon.indexOf('.');
              finalApiID = dotIndex > 0 ? afterDoubleColon.substring(0, dotIndex) : afterDoubleColon;
            } else {
              finalApiID = uid;
            }
          }

          if (!finalApiID) {
            this.logger.warn(`No apiID found for content type at index ${index}`, { uid, apiID, strapiType });
            finalApiID = 'unknown';
          }

          const info = schema?.info || strapiType?.info || {};
          const attributes = schema?.attributes || strapiType?.attributes || {};

          // Extract singularName and pluralName from schema
          // IMPORTANT: Never add 's' as fallback - only use Strapi's schema values
          const singularName = info?.singularName || schema?.singularName || finalApiID;
          const pluralName = info?.pluralName || schema?.pluralName;
          
          // If pluralName is missing, log warning but don't add 's' - this should not happen in properly configured Strapi
          if (!pluralName) {
            this.logger.warn(`Content type ${finalApiID} is missing pluralName in Strapi schema. This may cause API endpoint issues.`);
          }

          const result = {
            id: uid || finalApiID,
            name: finalApiID, // Keep apiID as name for backward compatibility
            singularName: singularName,
            pluralName: pluralName || null, // No fallback - must come from Strapi schema
            displayName: schema?.displayName || info?.displayName || finalApiID || 'Unknown',
            description: info?.description || schema?.description || '',
            attributes: attributes || {},
            createdAt: strapiType?.createdAt || new Date().toISOString(),
            updatedAt: strapiType?.updatedAt || new Date().toISOString(),
          };

          console.log(`Mapped content type ${index} result:`);
          return result;
        } catch (mapError: any) {
          this.logger.error(`Error mapping content type at index ${index}:`, {
            error: mapError.message,
            stack: mapError.stack,
            strapiType: JSON.stringify(strapiType).substring(0, 500),
          });
          throw new Error(`Failed to map content type at index ${index}: ${mapError.message}`);
        }
      });

      console.log('Successfully mapped all content types:', mappedContentTypes.length);
      return mappedContentTypes;
    } catch (error: any) {
      // If it's already an HttpException, re-throw it
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error('Error in getContentTypes mapping:', {
        error: error.message,
        stack: error.stack,
        filteredCount: filteredContentTypes.length,
      });
      // Check if it's a Strapi error
      if (error.response) {
        this.handleStrapiError(error, 'Failed to get content types');
      } else {
        throw new Error(`Failed to process content types: ${error.message}`);
      }
    }
    } catch (error: any) {
      // If it's already an HttpException, re-throw it
      if (error instanceof HttpException) {
        throw error;
      }
      // Check if it's a Strapi error from the initial API call
      if (error.response) {
        this.handleStrapiError(error, 'Failed to get content types from Strapi');
      } else {
        throw error;
      }
    }
  }

  async getContentType(slug: string, userRole: string): Promise<any> {
    // Content-Type Builder API doesn't support getting a single content type by name
    // We need to get all content types and filter by slug/name
    try {
      const response = await this.proxyUserService.forwardRequestToStrapi(
        'GET',
        '/api/content-type-builder/content-types',
        undefined,
        userRole,
      );
      console.log('getContentType response..........................', response);
      // Handle different response formats
      let contentTypesArray = [];
      if (Array.isArray(response?.data)) {
        contentTypesArray = response.data;
      } else if (response?.data?.data && Array.isArray(response.data.data)) {
        contentTypesArray = response.data.data;
      } else if (Array.isArray(response)) {
        contentTypesArray = response;
      }

      const filteredContentTypes = contentTypesArray.filter((strapiType: any) => {
        const schema = strapiType.schema || strapiType;
        const kind = schema?.kind || strapiType.kind;
        const visible = schema?.visible !== undefined ? schema.visible : true; // Default to true if not set

        // Include both collectionType and singleType, but exclude hidden ones (visible !== false)
        // This excludes plugin types like plugin::upload.file which have visible: false
        return (kind === 'collectionType' || kind === 'singleType') && visible !== false;
      });
      // Find the content type by slug/name
      // Try matching by apiID, singularName, or pluralName
      console.log('filteredContentTypes..........................', filteredContentTypes, 'slug..........................', slug);
      const contentType = filteredContentTypes.find((type: any) => {
        return type.schema.pluralName === slug;
      });

      if (!contentType) {
        throw new NotFoundException(`Content type '${slug}' not found`);
      }

      // Extract the schema if it exists, otherwise use the contentType directly
      const strapiType = contentType.schema || contentType;

      const info = strapiType.info || contentType.info || {};
      const singularName = info?.singularName || strapiType.singularName || contentType.apiID || strapiType.apiID;
      const pluralName = info?.pluralName || strapiType.pluralName || `${contentType.apiID || strapiType.apiID}s`;

      return {
        id: contentType.uid || strapiType.uid || strapiType.apiID,
        name: contentType.apiID || strapiType.apiID,
        singularName: singularName,
        pluralName: pluralName,
        displayName: strapiType.info?.displayName || contentType.info?.displayName || strapiType.apiID,
        description: strapiType.info?.description || contentType.info?.description || '',
        attributes: strapiType.attributes || contentType.attributes || {},
        createdAt: strapiType.createdAt || contentType.createdAt || new Date().toISOString(),
        updatedAt: strapiType.updatedAt || contentType.updatedAt || new Date().toISOString(),
      };
    } catch (error: any) {
      // If it's already an HttpException, re-throw it
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`Error getting content type '${slug}':`, error.message);
      // Check if it's a Strapi error
      if (error.response) {
        this.handleStrapiError(error, `Failed to get content type '${slug}'`);
      } else {
        throw new NotFoundException(`Content type '${slug}' not found: ${error.message}`);
      }
    }
  }

  async createContentType(createDto: CreateContentTypeDto, userRole: string): Promise<any> {
    // Only admin can create content types in Strapi
    if (userRole !== 'admin') {
      throw new BadRequestException('Only admin role can create content types');
    }

    // Directly create in Strapi - throw error if fails
    await this.createContentTypeInStrapi(createDto, userRole);

    // Return the created content type from Strapi
    return await this.getContentType(createDto.name, userRole);
  }

  /**
   * Create content type in Strapi using the Content-Type Builder API
   * This matches how Strapi creates content types programmatically
   */
  private async createContentTypeInStrapi(createDto: CreateContentTypeDto, userRole: string): Promise<void> {
    // Use the kind from DTO, default to 'collectionType' if not specified
    const kind = createDto.kind || 'collectionType';

    // Transform our DTO format to Strapi's schema format
    const strapiSchema: any = {
      kind: kind,
      collectionName: createDto.name,
      info: {
        singularName: createDto.name,
        pluralName: createDto.name,
        displayName: createDto.displayName,
        description: createDto.description || '',
      },
      options: {
        draftAndPublish: true, // Enable draft/publish workflow
      },
      pluginOptions: {},
      attributes: this.transformAttributesToStrapiFormat(createDto.attributes || {}),
    };

    // For single types, remove collectionName (Strapi doesn't use it for single types)
    if (kind === 'singleType') {
      delete strapiSchema.collectionName;
    }

    // Only admin can create content types in Strapi via Content-Type Builder API
    // Editor role doesn't have permission for this endpoint
    if (userRole !== 'admin') {
      throw new Error('Only admin role can create content types in Strapi');
    }

    try {
      await this.proxyUserService.forwardRequestToStrapi(
        'POST',
        '/api/content-type-builder/content-types',
        strapiSchema,
        'admin', // Must use admin proxy user
      );
    } catch (error: any) {
      // If it's already an HttpException, re-throw it
      if (error instanceof HttpException) {
        throw error;
      }
      // Re-throw with more context, preserving Strapi error
      if (error.response) {
        this.handleStrapiError(error, 'Failed to create content type in Strapi');
      } else {
        const errorMessage = error?.message || 'Unknown error occurred';
        throw new Error(`Failed to create content type in Strapi: ${errorMessage}`);
      }
    }
  }

  /**
   * Transform attributes from our format to Strapi's schema format
   */
  private transformAttributesToStrapiFormat(attributes: Record<string, any>): Record<string, any> {
    const strapiAttributes: Record<string, any> = {};

    for (const [fieldName, fieldConfig] of Object.entries(attributes)) {
      const fieldType = fieldConfig.type;
      const strapiAttribute: any = {
        type: this.mapFieldTypeToStrapi(fieldType),
      };

      // Map common properties
      if (fieldConfig.required !== undefined) {
        strapiAttribute.required = fieldConfig.required;
      }

      if (fieldConfig.unique !== undefined) {
        strapiAttribute.unique = fieldConfig.unique;
      }

      if (fieldConfig.default !== undefined) {
        strapiAttribute.default = fieldConfig.default;
      }

      // Type-specific configurations
      switch (fieldType) {
        case 'string':
        case 'text':
          if (fieldConfig.minLength !== undefined) {
            strapiAttribute.minLength = fieldConfig.minLength;
          }
          if (fieldConfig.maxLength !== undefined) {
            strapiAttribute.maxLength = fieldConfig.maxLength;
          }
          break;

        case 'integer':
        case 'biginteger':
        case 'float':
        case 'decimal':
          if (fieldConfig.min !== undefined) {
            strapiAttribute.min = fieldConfig.min;
          }
          if (fieldConfig.max !== undefined) {
            strapiAttribute.max = fieldConfig.max;
          }
          break;

        case 'enumeration':
          if (fieldConfig.enum) {
            strapiAttribute.enum = fieldConfig.enum;
          }
          break;

        case 'uid':
          strapiAttribute.targetField = fieldConfig.targetField;
          break;

        case 'media':
          strapiAttribute.allowedTypes = fieldConfig.allowedTypes || ['images', 'files', 'videos'];
          strapiAttribute.multiple = fieldConfig.multiple || false;
          break;

        case 'relation':
          if (fieldConfig.relation) {
            strapiAttribute.relation = fieldConfig.relation;
          }
          if (fieldConfig.target) {
            strapiAttribute.target = fieldConfig.target;
          }
          break;

        case 'component':
          if (fieldConfig.component) {
            strapiAttribute.component = fieldConfig.component;
          }
          strapiAttribute.repeatable = fieldConfig.repeatable || false;
          break;
      }

      strapiAttributes[fieldName] = strapiAttribute;
    }

    return strapiAttributes;
  }

  /**
   * Map our field type names to Strapi's field type names
   */
  private mapFieldTypeToStrapi(type: string): string {
    const typeMap: Record<string, string> = {
      string: 'string',
      text: 'text',
      richtext: 'richtext',
      email: 'email',
      password: 'password',
      enumeration: 'enumeration',
      date: 'date',
      time: 'time',
      datetime: 'datetime',
      timestamp: 'timestamp',
      integer: 'integer',
      biginteger: 'biginteger',
      float: 'float',
      decimal: 'decimal',
      json: 'json',
      boolean: 'boolean',
      media: 'media',
      relation: 'relation',
      component: 'component',
      dynamiczone: 'dynamiczone',
      uid: 'uid',
    };

    return typeMap[type.toLowerCase()] || type;
  }

  async getContentItems(contentType: string, params: any, userRole: string) {
    // Get the correct plural name for the content type (e.g., "studies" not "studys")
    const pluralName = await this.getPluralName(contentType, userRole);
    
    // Add 'status': 'draft' to include both published and draft content in Strapi 5.x
    const queryParams = new URLSearchParams({
      'status': 'draft', // Include both published and draft content
      ...params, // Merge with any additional params from frontend
    });
    
    const url = `/api/${pluralName}?${queryParams.toString()}`;

    try {
      // Directly call Strapi - throw error if fails
      const response = await this.proxyUserService.forwardRequestToStrapi(
        'GET',
        url,
        undefined,
        userRole,
      );

      return response;
    } catch (error: any) {
      this.handleStrapiError(error, `Failed to get content items from ${contentType}`);
    }
  }

  async getContentItem(contentType: string, id: string, userRole: string) {
    // Get the correct plural name for the content type (e.g., "studies" not "studys")
    const pluralName = await this.getPluralName(contentType, userRole);
    
    // Directly call Strapi - throw error if fails
    // In Strapi 5.x, try numeric ID first with status=draft to include draft content, then try with publicationState=preview
    try {
      // First try: Get content by numeric ID with status=draft to include both published and draft
      const response = await this.proxyUserService.forwardRequestToStrapi(
        'GET',
        `/api/${pluralName}/${id}?status=draft`,
        undefined,
        userRole,
      );

      console.log('response..........................', response);
      return response;
    } catch (error: any) {
      // If 404, try with publicationState=preview to include draft content
      if (error.response?.status === 404) {
        this.logger.debug(`Content item ${id} not found with status=draft, trying with publicationState=preview`);
        try {
          const response = await this.proxyUserService.forwardRequestToStrapi(
            'GET',
            `/api/${pluralName}/${id}?publicationState=preview`,
            undefined,
            userRole,
          );
          return response;
        } catch (previewError: any) {
          // If still 404, try using documentId filter with status=draft (in case id is actually a documentId)
          this.logger.debug(`Content item ${id} not found with preview, trying documentId filter with status=draft`);
          try {
            const response = await this.proxyUserService.forwardRequestToStrapi(
              'GET',
              `/api/${pluralName}?filters[documentId][$eq]=${id}&status=draft`,
              undefined,
              userRole,
            );
            // If found, return the first item
            if (response?.data && Array.isArray(response.data) && response.data.length > 0) {
              return { data: response.data[0] };
            }
            throw new NotFoundException(`Content item with ID '${id}' not found`);
          } catch (docIdError: any) {
            // If all attempts fail, throw the original error
            this.logger.error(`Failed to get content item ${id} from ${contentType}:`, {
              numericIdError: error.response?.status,
              previewError: previewError.response?.status,
              documentIdError: docIdError.response?.status,
            });
            throw new NotFoundException(`Content item with ID '${id}' not found in content type '${contentType}'`);
          }
        }
      }
      // Re-throw non-404 errors with proper error handling
      this.handleStrapiError(error, `Failed to get content item ${id} from ${contentType}`);
    }
  }

  async createContentItem(contentType: string, data: any, userRole: string) {
    // Get the correct plural name for the content type (e.g., "studies" not "studys")
    const pluralName = await this.getPluralName(contentType, userRole);
    
    try {
      // Directly call Strapi - throw error if fails
      const response = await this.proxyUserService.forwardRequestToStrapi(
        'POST',
        `/api/${pluralName}`,
        { data },
        userRole,
      );

      return response;
    } catch (error: any) {
      this.handleStrapiError(error, `Failed to create content item in ${contentType}`);
    }
  }

  async updateContentItem(contentType: string, id: string, data: any, userRole: string) {
    // Get the correct plural name for the content type (e.g., "studies" not "studys")
    const pluralName = await this.getPluralName(contentType, userRole);
    
    try {
      // Directly call Strapi - throw error if fails
      const response = await this.proxyUserService.forwardRequestToStrapi(
        'PUT',
        `/api/${pluralName}/${id}`,
        { data: data },
        userRole,
      );

      return response;
    } catch (error: any) {
      this.handleStrapiError(error, `Failed to update content item ${id} in ${contentType}`);
    }
  }

  async deleteContentItem(contentType: string, id: string, userRole: string) {
    // Get the correct plural name for the content type (e.g., "studies" not "studys")
    const pluralName = await this.getPluralName(contentType, userRole);
    
    try {
      // Directly call Strapi - throw error if fails
      await this.proxyUserService.forwardRequestToStrapi(
        'DELETE',
        `/api/${pluralName}/${id}`,
        undefined,
        userRole,
      );

      return { success: true };
    } catch (error: any) {
      this.handleStrapiError(error, `Failed to delete content item ${id} from ${contentType}`);
    }
  }

}