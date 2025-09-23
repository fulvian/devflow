/**
 * OAuth Credential Management System for CLI Agents
 * 
 * This module provides a robust system for managing OAuth credentials for various CLI agents
 * including ChatGPT Plus, Codex, Gemini, and Qwen. It handles token validation, automatic
 * refresh, and fallback mechanisms.
 */

import { EventEmitter } from 'events';
import { createLogger, format, transports } from 'winston';
import axios, { AxiosError, AxiosInstance } from 'axios';

// Interfaces for type safety
interface OAuthCredentials {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
  scope: string;
  issuedAt: number;
}

interface AgentConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  tokenEndpoint: string;
  authEndpoint: string;
  apiBaseURL: string;
  scopes: string[];
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

interface ValidationResult {
  isValid: boolean;
  expiresAt: number;
  needsRefresh: boolean;
}

// Custom error classes for better error handling
class OAuthError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'OAuthError';
  }
}

class TokenRefreshError extends OAuthError {
  constructor(message: string) {
    super(message, 'TOKEN_REFRESH_FAILED');
    this.name = 'TokenRefreshError';
  }
}

class ValidationError extends OAuthError {
  constructor(message: string) {
    super(message, 'VALIDATION_FAILED');
    this.name = 'ValidationError';
  }
}

// Logger configuration
const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.json()
  ),
  transports: [
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.simple()
      )
    }),
    new transports.File({ filename: 'oauth-system.log' })
  ]
});

/**
 * OAuth Credential Manager
 * Handles credential storage, validation, and refresh for CLI agents
 */
class OAuthCredentialManager extends EventEmitter {
  private credentials: Map<string, OAuthCredentials> = new Map();
  private agents: Map<string, AgentConfig> = new Map();
  private httpClients: Map<string, AxiosInstance> = new Map();
  private refreshPromises: Map<string, Promise<OAuthCredentials>> = new Map();

  constructor() {
    super();
  }

  /**
   * Register a new agent with its OAuth configuration
   * @param agentId Unique identifier for the agent
   * @param config Agent OAuth configuration
   */
  registerAgent(agentId: string, config: AgentConfig): void {
    this.agents.set(agentId, config);
    
    // Create HTTP client for this agent
    const client = axios.create({
      baseURL: config.apiBaseURL,
      timeout: 10000
    });
    
    // Add request interceptor to automatically attach access token
    client.interceptors.request.use((config) => {
      const credentials = this.credentials.get(agentId);
      if (credentials) {
        config.headers.Authorization = `${credentials.tokenType} ${credentials.accessToken}`;
      }
      return config;
    });
    
    // Add response interceptor to handle 401 and trigger token refresh
    client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        if (error.response?.status === 401) {
          logger.info(`Token expired for agent ${agentId}, attempting refresh`);
          try {
            await this.refreshToken(agentId);
            // Retry the original request
            return client.request(error.config);
          } catch (refreshError) {
            logger.error(`Token refresh failed for agent ${agentId}`, refreshError);
            this.emit('tokenRefreshFailed', agentId, refreshError);
            throw new TokenRefreshError(`Failed to refresh token for ${agentId}`);
          }
        }
        return Promise.reject(error);
      }
    );
    
    this.httpClients.set(agentId, client);
    logger.info(`Registered agent: ${agentId}`);
  }

  /**
   * Store OAuth credentials for an agent
   * @param agentId Agent identifier
   * @param credentials OAuth credentials
   */
  setCredentials(agentId: string, credentials: OAuthCredentials): void {
    if (!this.agents.has(agentId)) {
      throw new OAuthError(`Agent ${agentId} is not registered`);
    }
    
    this.credentials.set(agentId, credentials);
    logger.info(`Stored credentials for agent: ${agentId}`);
    this.emit('credentialsUpdated', agentId, credentials);
  }

  /**
   * Get HTTP client for an agent (with automatic token attachment)
   * @param agentId Agent identifier
   * @returns Axios instance configured for the agent
   */
  getHttpClient(agentId: string): AxiosInstance {
    const client = this.httpClients.get(agentId);
    if (!client) {
      throw new OAuthError(`No HTTP client found for agent ${agentId}`);
    }
    return client;
  }

  /**
   * Validate if credentials are still valid
   * @param agentId Agent identifier
   * @returns Validation result with expiration info
   */
  validateCredentials(agentId: string): ValidationResult {
    const credentials = this.credentials.get(agentId);
    if (!credentials) {
      return { isValid: false, expiresAt: 0, needsRefresh: true };
    }

    const now = Date.now();
    const expiresAt = credentials.issuedAt + (credentials.expiresIn * 1000);
    const isValid = now < expiresAt;
    // Refresh if token expires in less than 5 minutes
    const needsRefresh = (expiresAt - now) < 5 * 60 * 1000;

    logger.debug(`Validation result for ${agentId}: valid=${isValid}, needsRefresh=${needsRefresh}`);
    
    return { isValid, expiresAt, needsRefresh };
  }

  /**
   * Refresh OAuth token for an agent
   * @param agentId Agent identifier
   * @returns Promise resolving to new credentials
   */
  async refreshToken(agentId: string): Promise<OAuthCredentials> {
    // Return existing promise if refresh is already in progress
    if (this.refreshPromises.has(agentId)) {
      return this.refreshPromises.get(agentId)!;
    }

    const refreshPromise = this._performTokenRefresh(agentId);
    this.refreshPromises.set(agentId, refreshPromise);

    try {
      const newCredentials = await refreshPromise;
      this.setCredentials(agentId, newCredentials);
      this.emit('tokenRefreshed', agentId, newCredentials);
      return newCredentials;
    } catch (error) {
      this.emit('tokenRefreshFailed', agentId, error);
      throw error;
    } finally {
      this.refreshPromises.delete(agentId);
    }
  }

  /**
   * Internal method to perform the actual token refresh
   * @param agentId Agent identifier
   * @returns Promise resolving to new credentials
   */
  private async _performTokenRefresh(agentId: string): Promise<OAuthCredentials> {
    const credentials = this.credentials.get(agentId);
    const config = this.agents.get(agentId);

    if (!credentials || !config) {
      throw new ValidationError(`Missing credentials or config for agent ${agentId}`);
    }

    if (!credentials.refreshToken) {
      throw new ValidationError(`No refresh token available for agent ${agentId}`);
    }

    logger.info(`Refreshing token for agent: ${agentId}`);

    try {
      const response = await axios.post<TokenResponse>(config.tokenEndpoint, {
        grant_type: 'refresh_token',
        refresh_token: credentials.refreshToken,
        client_id: config.clientId,
        client_secret: config.clientSecret
      }, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      const tokenData = response.data;
      
      const newCredentials: OAuthCredentials = {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || credentials.refreshToken,
        expiresIn: tokenData.expires_in,
        tokenType: tokenData.token_type,
        scope: tokenData.scope,
        issuedAt: Date.now()
      };

      logger.info(`Successfully refreshed token for agent: ${agentId}`);
      return newCredentials;
    } catch (error) {
      logger.error(`Failed to refresh token for agent ${agentId}`, error);
      throw new TokenRefreshError(`Token refresh failed for ${agentId}: ${error.message}`);
    }
  }

  /**
   * Get authorization URL for initial OAuth flow
   * @param agentId Agent identifier
   * @param state Optional state parameter for security
   * @returns Authorization URL
   */
  getAuthorizationURL(agentId: string, state?: string): string {
    const config = this.agents.get(agentId);
    if (!config) {
      throw new OAuthError(`Agent ${agentId} is not registered`);
    }

    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope: config.scopes.join(' '),
      ...(state && { state })
    });

    return `${config.authEndpoint}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   * @param agentId Agent identifier
   * @param code Authorization code
   * @returns OAuth credentials
   */
  async exchangeCodeForTokens(agentId: string, code: string): Promise<OAuthCredentials> {
    const config = this.agents.get(agentId);
    if (!config) {
      throw new OAuthError(`Agent ${agentId} is not registered`);
    }

    try {
      const response = await axios.post<TokenResponse>(config.tokenEndpoint, {
        grant_type: 'authorization_code',
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri
      }, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      const tokenData = response.data;
      
      const credentials: OAuthCredentials = {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token!,
        expiresIn: tokenData.expires_in,
        tokenType: tokenData.token_type,
        scope: tokenData.scope,
        issuedAt: Date.now()
      };

      logger.info(`Successfully exchanged code for tokens for agent: ${agentId}`);
      return credentials;
    } catch (error) {
      logger.error(`Failed to exchange code for tokens for agent ${agentId}`, error);
      throw new OAuthError(`Code exchange failed for ${agentId}: ${error.message}`);
    }
  }

  /**
   * Revoke tokens for an agent (logout)
   * @param agentId Agent identifier
   */
  async revokeTokens(agentId: string): Promise<void> {
    const credentials = this.credentials.get(agentId);
    const config = this.agents.get(agentId);

    if (!credentials || !config) {
      logger.warn(`No credentials to revoke for agent: ${agentId}`);
      return;
    }

    try {
      // Try to revoke the token if the provider supports it
      await axios.post(config.tokenEndpoint.replace('token', 'revoke'), {
        token: credentials.accessToken,
        client_id: config.clientId,
        client_secret: config.clientSecret
      });
    } catch (error) {
      logger.warn(`Token revocation failed for agent ${agentId} (this may be expected)`, error);
    }

    // Remove local credentials regardless
    this.credentials.delete(agentId);
    logger.info(`Revoked tokens for agent: ${agentId}`);
    this.emit('tokensRevoked', agentId);
  }

  /**
   * Check if an agent has valid credentials
   * @param agentId Agent identifier
   * @returns Boolean indicating if agent has valid credentials
   */
  hasValidCredentials(agentId: string): boolean {
    const validation = this.validateCredentials(agentId);
    return validation.isValid && !validation.needsRefresh;
  }
}

// Export types and classes
export {
  OAuthCredentials,
  AgentConfig,
  ValidationResult,
  OAuthError,
  TokenRefreshError,
  ValidationError,
  OAuthCredentialManager
};

// Create and export a singleton instance
export const oauthManager = new OAuthCredentialManager();

// Example usage:
/*
// Register agents
oauthManager.registerAgent('chatgpt-plus', {
  clientId: process.env.CHATGPT_CLIENT_ID!,
  clientSecret: process.env.CHATGPT_CLIENT_SECRET!,
  redirectUri: 'http://localhost:3000/callback',
  tokenEndpoint: 'https://api.openai.com/v1/oauth/token',
  authEndpoint: 'https://platform.openai.com/oauth/authorize',
  apiBaseURL: 'https://api.openai.com/v1',
  scopes: ['read', 'write']
});

// Handle events
oauthManager.on('tokenRefreshed', (agentId, credentials) => {
  console.log(`Token refreshed for ${agentId}`);
});

oauthManager.on('tokenRefreshFailed', (agentId, error) => {
  console.error(`Token refresh failed for ${agentId}:`, error);
});

// Use the HTTP client (tokens are automatically attached)
const chatGptClient = oauthManager.getHttpClient('chatgpt-plus');
chatGptClient.post('/completions', { prompt: 'Hello world' });
*/