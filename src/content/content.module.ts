import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContentController } from './content.controller';
import { ContentService } from './content.service';
import { AuditService } from './audit.service';
import { ProxyModule } from '../proxy/proxy.module';
import { ContentAuditLog } from './entities/content-audit-log.entity';

@Module({
  imports: [
    ProxyModule,
    TypeOrmModule.forFeature([ContentAuditLog]),
  ],
  controllers: [ContentController],
  providers: [ContentService, AuditService],
  exports: [ContentService, AuditService],
})
export class ContentModule {}
