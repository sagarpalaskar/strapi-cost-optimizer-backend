import { Module } from '@nestjs/common';
import { ProxyUserService } from './proxy-user.service';
// import { RedisModule } from '../redis/redis.module'; // Commented out - will use Redis later

@Module({
  // imports: [RedisModule], // Commented out - will use Redis later
  providers: [ProxyUserService],
  exports: [ProxyUserService],
})
export class ProxyModule {}
