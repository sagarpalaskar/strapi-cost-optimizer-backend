import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { AzureEasyAuthStrategy } from './strategies/azure-easy-auth.strategy';
import { SessionService } from './services/session.service';
import { AzureEasyAuthGuard } from './guards/azure-easy-auth.guard';
import { CombinedAuthGuard } from './guards/combined-auth.guard';
import { User } from './entities/user.entity';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'your-secret-key-change-this-in-production',
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN') || '7d',
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    AzureEasyAuthStrategy,
    SessionService,
    AzureEasyAuthGuard,
    CombinedAuthGuard,
    JwtAuthGuard
  ],
  exports: [AuthService, SessionService, AzureEasyAuthGuard, CombinedAuthGuard],
})
export class AuthModule {}
