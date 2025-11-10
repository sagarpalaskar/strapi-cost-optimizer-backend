import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { User } from '../auth/entities/user.entity';
import { ContentType } from '../content/entities/content-type.entity';
import { ContentItem } from '../content/entities/content-item.entity';
import { ContentAuditLog } from '../content/entities/content-audit-log.entity';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DB_HOST') || 'localhost',
        port: configService.get<number>('DB_PORT') || 5432,
        username: configService.get('DB_USERNAME') || 'postgres',
        password: configService.get('DB_PASSWORD') || 'postgres',
        database: configService.get('DB_NAME') || 'strapi_cost_optimizer',
        entities: [User, ContentType, ContentItem, ContentAuditLog],
        synchronize: configService.get('NODE_ENV') !== 'production', // Auto-create tables in dev
        logging: configService.get('NODE_ENV') === 'development',
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([User, ContentType, ContentItem, ContentAuditLog]),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
