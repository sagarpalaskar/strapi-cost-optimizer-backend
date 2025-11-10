import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
// import { RedisModule } from './redis/redis.module'; // Commented out - will use Redis later
import { ProxyModule } from './proxy/proxy.module';
import { AuthModule } from './auth/auth.module';
import { ContentModule } from './content/content.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    // RedisModule, // Commented out - will use Redis later
    DatabaseModule,
    ProxyModule,
    AuthModule,
    DashboardModule, // Load before ContentModule to ensure route priority
    ContentModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
