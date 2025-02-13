import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'; // ^1.6.0
import axiosRetry from 'axios-retry'; // ^3.8.0
import { setupCache, Cache } from 'axios-cache-adapter'; // ^2.7.3

import { User, AuthToken, LoginCredentials, isValidAuthToken } from '../types/auth';
import { ICampaign, CampaignStatus } from '../types/campaign';
import { IAnalyticsData, TimeRange, MetricType } from '../types/analytics';
import { PlatformType, PlatformIntegrationStatus } from '../types/platform';
import { ApiError, isSuccessResponse, isErrorResponse } from '../types/common';

// API Configuration Constants
const API_VERSION = 'v1';
const DEFAULT_TIMEOUT = 30000;
const MAX_RETRY_ATTEMPTS = 3;
const CACHE_DURATION = 300000; // 5 minutes
const RATE_LIMIT_REQUESTS = 100;
const RATE_LIMIT_INTERVAL = 60000; // 1 minute

/**
 * Circuit breaker state management
 */
class CircuitBreaker {
    private failures: number = 0;
    private lastFailureTime?: Date;
    private readonly threshold: number = 5;
    private readonly resetTimeout: number = 60000;

    public isOpen(): boolean {
        if (!this.lastFailureTime) return false;
        const timeSinceLastFailure = Date.now() - this.lastFailureTime.getTime();
        return this.failures >= this.threshold && timeSinceLastFailure < this.resetTimeout;
    }

    public recordFailure(): void {
        this.failures++;
        this.lastFailureTime = new Date();
    }

    public reset(): void {
        this.failures = 0;
        this.lastFailureTime = undefined;
    }
}

/**
 * API client configuration interface
 */
interface ApiClientConfig {
    timeout?: number;
    retryAttempts?: number;
    cacheDuration?: number;
    enableCircuitBreaker?: boolean;
}

/**
 * Enterprise-grade API client implementation with enhanced features
 */
export class ApiClient {
    private readonly baseURL: string;
    private readonly client: AxiosInstance;
    private readonly cache: Cache;
    private readonly circuitBreaker: CircuitBreaker;
    private refreshTokenTimeout?: NodeJS.Timeout;

    constructor(baseURL: string, config: ApiClientConfig = {}) {
        this.baseURL = baseURL;
        this.circuitBreaker = new CircuitBreaker();

        // Configure caching
        this.cache = setupCache({
            maxAge: config.cacheDuration || CACHE_DURATION,
            exclude: { query: false },
            clearOnError: true
        });

        // Initialize axios instance
        this.client = axios.create({
            baseURL: `${baseURL}/api/${API_VERSION}`,
            timeout: config.timeout || DEFAULT_TIMEOUT,
            adapter: this.cache.adapter
        });

        // Configure retry logic
        axiosRetry(this.client, {
            retries: config.retryAttempts || MAX_RETRY_ATTEMPTS,
            retryDelay: axiosRetry.exponentialDelay,
            retryCondition: (error) => {
                return axiosRetry.isNetworkOrIdempotentRequestError(error) && 
                       !this.circuitBreaker.isOpen();
            }
        });

        // Request interceptor for authentication and circuit breaker
        this.client.interceptors.request.use(
            async (config) => {
                if (this.circuitBreaker.isOpen()) {
                    throw new Error('Circuit breaker is open');
                }

                const token = await this.getAuthToken();
                if (token) {
                    config.headers.Authorization = `Bearer ${token}`;
                }
                return config;
            }
        );

        // Response interceptor for error handling and circuit breaker
        this.client.interceptors.response.use(
            (response) => response,
            async (error) => {
                if (error.response?.status === 401) {
                    return this.handleUnauthorized(error);
                }

                if (error.response?.status >= 500) {
                    this.circuitBreaker.recordFailure();
                }

                throw this.normalizeError(error);
            }
        );
    }

    /**
     * User authentication with enhanced security
     */
    public async login(credentials: LoginCredentials): Promise<AuthToken> {
        try {
            const response = await this.client.post<AuthToken>('/auth/login', credentials);
            const token = response.data;

            if (isValidAuthToken(token)) {
                this.setupTokenRefresh(token);
                return token;
            }

            throw new Error('Invalid token response');
        } catch (error) {
            throw this.normalizeError(error);
        }
    }

    /**
     * Token refresh implementation
     */
    private async refreshToken(refreshToken: string): Promise<AuthToken> {
        try {
            const response = await this.client.post<AuthToken>('/auth/refresh', { refreshToken });
            const token = response.data;

            if (isValidAuthToken(token)) {
                this.setupTokenRefresh(token);
                return token;
            }

            throw new Error('Invalid refresh token response');
        } catch (error) {
            throw this.normalizeError(error);
        }
    }

    /**
     * Campaign creation with platform-specific optimization
     */
    public async createCampaign(campaign: Partial<ICampaign>): Promise<ICampaign> {
        try {
            const response = await this.client.post<ICampaign>('/campaigns', campaign);
            return response.data;
        } catch (error) {
            throw this.normalizeError(error);
        }
    }

    /**
     * Real-time campaign analytics with caching
     */
    public async getCampaignAnalytics(
        campaignId: string,
        timeRange: TimeRange,
        metrics: MetricType[] = []
    ): Promise<IAnalyticsData> {
        try {
            const response = await this.client.get<IAnalyticsData>(`/analytics/campaigns/${campaignId}`, {
                params: { timeRange, metrics },
                cache: {
                    maxAge: timeRange === TimeRange.TODAY ? 60000 : CACHE_DURATION
                }
            });
            return response.data;
        } catch (error) {
            throw this.normalizeError(error);
        }
    }

    /**
     * Platform integration status check
     */
    public async getPlatformStatus(platform: PlatformType): Promise<PlatformIntegrationStatus> {
        try {
            const response = await this.client.get<PlatformIntegrationStatus>(
                `/platforms/${platform}/status`
            );
            return response.data;
        } catch (error) {
            throw this.normalizeError(error);
        }
    }

    /**
     * Campaign status update with optimistic updates
     */
    public async updateCampaignStatus(
        campaignId: string,
        status: CampaignStatus
    ): Promise<ICampaign> {
        try {
            const response = await this.client.patch<ICampaign>(
                `/campaigns/${campaignId}/status`,
                { status }
            );
            return response.data;
        } catch (error) {
            throw this.normalizeError(error);
        }
    }

    /**
     * Error normalization utility
     */
    private normalizeError(error: any): ApiError {
        if (isErrorResponse(error.response?.data)) {
            return error.response.data.error;
        }

        return {
            code: error.response?.status?.toString() || 'UNKNOWN_ERROR',
            message: error.message || 'An unknown error occurred',
            details: error.response?.data
        };
    }

    /**
     * Unauthorized error handler
     */
    private async handleUnauthorized(error: any): Promise<AxiosResponse> {
        const refreshToken = await this.getRefreshToken();
        if (!refreshToken) {
            throw this.normalizeError(error);
        }

        try {
            const token = await this.refreshToken(refreshToken);
            const failedRequest = error.config;
            failedRequest.headers.Authorization = `Bearer ${token.accessToken}`;
            return this.client(failedRequest);
        } catch (refreshError) {
            throw this.normalizeError(refreshError);
        }
    }

    /**
     * Token refresh setup
     */
    private setupTokenRefresh(token: AuthToken): void {
        if (this.refreshTokenTimeout) {
            clearTimeout(this.refreshTokenTimeout);
        }

        const refreshTime = (token.expiresIn - 300) * 1000; // Refresh 5 minutes before expiry
        this.refreshTokenTimeout = setTimeout(
            () => this.refreshToken(token.refreshToken),
            refreshTime
        );
    }

    // Token management methods to be implemented based on storage strategy
    private async getAuthToken(): Promise<string | null> {
        // Implementation depends on token storage strategy
        return null;
    }

    private async getRefreshToken(): Promise<string | null> {
        // Implementation depends on token storage strategy
        return null;
    }
}