import { Module } from '@nestjs/common';
import { KeyVaultService } from './keyvault.service';

@Module({
  providers: [KeyVaultService],
  exports: [KeyVaultService],
})
export class KeyVaultModule {}

