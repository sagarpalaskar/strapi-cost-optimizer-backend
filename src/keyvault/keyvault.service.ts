import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SecretClient } from '@azure/keyvault-secrets';
import { DefaultAzureCredential } from '@azure/identity';

@Injectable()
export class KeyVaultService implements OnModuleInit {
  private readonly logger = new Logger(KeyVaultService.name);
  private secretClient: SecretClient | null = null;
  private keyVaultUrl: string | null = null;
  private isKeyVaultEnabled: boolean = false;
  private cache: Map<string, string> = new Map();

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    // Get Key Vault URL from environment
    this.keyVaultUrl = this.configService.get<string>('AZURE_KEY_VAULT_URL') || null;

    if (this.keyVaultUrl) {
      try {
        // Initialize Azure Key Vault client
        const credential = new DefaultAzureCredential();
        this.secretClient = new SecretClient(this.keyVaultUrl, credential);
        this.isKeyVaultEnabled = true;
        this.logger.log(`Azure Key Vault initialized: ${this.keyVaultUrl}`);
      } catch (error) {
        this.logger.warn(
          `Failed to initialize Azure Key Vault: ${error.message}. Falling back to .env file.`,
        );
        this.isKeyVaultEnabled = false;
      }
    } else {
      this.logger.log('Azure Key Vault URL not configured. Using .env file for secrets.');
      this.isKeyVaultEnabled = false;
    }
  }

  /**
   * Get a secret value from Azure Key Vault or fallback to .env
   * @param secretName - Name of the secret in Key Vault or environment variable name
   * @returns Secret value or null if not found
   */
  async getSecret(secretName: string): Promise<string | null> {
    // Check cache first
    if (this.cache.has(secretName)) {
      return this.cache.get(secretName) || null;
    }

    let value: string | null = null;

    // Try to get from Key Vault first
    if (this.isKeyVaultEnabled && this.secretClient) {
      try {
        const secret = await this.secretClient.getSecret(secretName);
        if (secret && secret.value) {
          value = secret.value;
          this.logger.debug(`Retrieved secret '${secretName}' from Azure Key Vault`);
          // Cache the value
          this.cache.set(secretName, value);
          return value;
        }
      } catch (error) {
        // Key Vault error - log and fallback to .env
        this.logger.warn(
          `Failed to retrieve secret '${secretName}' from Azure Key Vault: ${error.message}. Falling back to .env`,
        );
      }
    }

    // Fallback to .env file
    value = this.configService.get<string>(secretName) || null;
    if (value) {
      this.logger.debug(`Retrieved secret '${secretName}' from .env file`);
      // Cache the value
      this.cache.set(secretName, value);
    } else {
      this.logger.warn(`Secret '${secretName}' not found in Key Vault or .env file`);
    }

    return value;
  }

  /**
   * Get STRAPI_API_TOKEN_EDITOR from Key Vault or .env
   */
  async getStrapiApiTokenEditor(): Promise<string | null> {
    return this.getSecret('STRAPI_API_TOKEN_EDITOR');
  }

  /**
   * Get STRAPI_API_TOKEN_ADMIN from Key Vault or .env
   */
  async getStrapiApiTokenAdmin(): Promise<string | null> {
    return this.getSecret('STRAPI_API_TOKEN_ADMIN');
  }

  /**
   * Get STRAPI_API_TOKEN_AUTHOR from Key Vault or .env
   */
  async getStrapiApiTokenAuthor(): Promise<string | null> {
    return this.getSecret('STRAPI_API_TOKEN_AUTHOR');
  }

  /**
   * Get STRAPI_API_TOKEN_VIEWER from Key Vault or .env
   */
  async getStrapiApiTokenViewer(): Promise<string | null> {
    return this.getSecret('STRAPI_API_TOKEN_VIEWER');
  }

  /**
   * Clear the cache (useful for testing or when secrets are updated)
   */
  clearCache(): void {
    this.cache.clear();
    this.logger.debug('Key Vault cache cleared');
  }

  /**
   * Check if Key Vault is enabled and available
   */
  isKeyVaultAvailable(): boolean {
    return this.isKeyVaultEnabled;
  }
}

