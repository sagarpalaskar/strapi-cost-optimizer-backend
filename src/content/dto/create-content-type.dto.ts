import { IsString, IsNotEmpty, MinLength, IsOptional, IsObject, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateContentTypeDto {
  @ApiProperty({ 
    description: 'Content type name (slug, e.g., "articles", "products")',
    example: 'blog-posts',
    minLength: 2,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  name: string;

  @ApiProperty({ 
    description: 'Display name for the content type',
    example: 'Blog Posts',
  })
  @IsString()
  @IsNotEmpty()
  displayName: string;

  @ApiPropertyOptional({ 
    description: 'Type of content: "collectionType" for multiple entries (like blog posts, products) or "singleType" for single entry (like homepage, settings). Defaults to "collectionType".',
    example: 'collectionType',
    enum: ['collectionType', 'singleType'],
    default: 'collectionType',
  })
  @IsOptional()
  @IsString()
  @IsIn(['collectionType', 'singleType'])
  kind?: 'collectionType' | 'singleType';

  @ApiPropertyOptional({ 
    description: 'Description of the content type',
    example: 'Blog posts and articles',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ 
    description: 'Attributes schema for the content type. Supports unlimited fields with various types. All Strapi field types are supported: string, text, richtext, email, password, enumeration, date, time, datetime, timestamp, integer, biginteger, float, decimal, json, boolean, media, relation, component, dynamiczone, uid. Each field can have additional properties like required, unique, default, min, max, minLength, maxLength, etc.',
    example: {
      title: { type: 'string', required: true },
      content: { type: 'richtext', required: true },
      slug: { type: 'uid', targetField: 'title' },
      excerpt: { type: 'text', maxLength: 500 },
      author: { type: 'string' },
      publishedAt: { type: 'datetime' },
      isFeatured: { type: 'boolean', default: false },
      views: { type: 'integer', default: 0 },
      rating: { type: 'decimal', min: 0, max: 5 },
      category: { type: 'enumeration', enum: ['tech', 'lifestyle', 'business'], default: 'tech' },
      tags: { type: 'json' },
      thumbnail: { type: 'media' },
      gallery: { type: 'media', multiple: true },
      seoTitle: { type: 'string', maxLength: 60 },
      seoDescription: { type: 'text', maxLength: 160 },
      metadata: { type: 'json' },
    },
  })
  @IsOptional()
  @IsObject()
  attributes?: Record<string, any>;
}

