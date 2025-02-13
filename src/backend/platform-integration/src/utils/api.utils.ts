// External imports
import axios, { AxiosInstance, AxiosError, AxiosRequestConfig } from 'axios'; // ^1.6.0
import axiosRetry from 'axios-retry'; // ^3.8.0
import CircuitBreaker from 'opossum'; // ^7.1.0

// Internal imports
import { platforms, api } from '../config';
import { PlatformType } from '../../../shared/types/campaign.types';

/**
 * Custom error class for API-related errors with platform context
 */
class ApiError extends Error {
    constructor(
        message: string,
        public platform: PlatformType,
        public statusCode?: number,
        public errorCode?: string,
        public retryable: boolean = false
    ) {
        super(message);
        this.name = 'ApiError';
    }
}

/**
 * Platform-specific error code mappings
 */
const ERROR_CODES = {
    [PlatformType.LINKEDIN]: {
        0: 'UNKNOWN_ERROR',
        401: 'UNAUTHORIZED',
        403: 'FORBIDDEN',
        404: 'RESOURCE_NOT_FOUND',
        429: 'RATE_LIMIT_EXCEEDED',
        500: 'INTERNAL_SERVER_ERROR'
    },
    [PlatformType.GOOGLE]: {
        AUTH_ERROR: 'UNAUTHORIZED',
        INVALID_REQUEST: 'BAD_REQUEST',
        QUOTA_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
        INTERNAL_ERROR: 'INTERNAL_SERVER_ERROR'
    }
};

/**
 * Creates and configures an API client instance for a specific platform
 * @param platform Platform type (LINKEDIN or GOOGLE)
 * @param options Additional axios configuration options
 * @returns Configured axios instance with retry and circuit breaker
 */
export const createApiClient = (
    platform: PlatformType,
    options: AxiosRequestConfig = {}
): AxiosInstance => {
    const platformConfig = platforms[platform];
    const circuitBreakerConfig = api.circuitBreaker;

    // Create base axios instance
    const client = axios.create({
        baseURL: platformConfig.baseUrl,
        timeout: platformConfig.timeout,
        headers: {
            'Content-Type': 'application/json',
            'User-Agent': `SalesIntelligencePlatform/${platform}`,
            'Accept': 'application/json',
            'X-Api-Version': platformConfig.apiVersion
        },
        ...options
    });

    // Configure retry mechanism
    axiosRetry(client, {
        retries: platformConfig.retryAttempts,
        retryDelay: axiosRetry.exponentialDelay,
        retryCondition: (error: AxiosError) => {
            const shouldRetry = axiosRetry.isNetworkOrIdempotentRequestError(error);
            const statusCode = error.response?.status;
            return shouldRetry || statusCode === 429 || (statusCode && statusCode >= 500);
        },
        onRetry: (retryCount, error, requestConfig) => {
            console.warn(
                `Retry attempt ${retryCount} for ${requestConfig.url} due to ${error.message}`
            );
        }
    });

    // Initialize circuit breaker
    const breaker = new CircuitBreaker(client, {
        timeout: circuitBreakerConfig.resetTimeout,
        errorThresholdPercentage: circuitBreakerConfig.failureThreshold,
        resetTimeout: circuitBreakerConfig.resetTimeout,
        allowWarmUp: true,
        volumeThreshold: 10,
        errorFilter: (error: Error) => {
            return error.name === 'ApiError' && !error.message.includes('RATE_LIMIT');
        }
    });

    // Add request interceptor for rate limiting
    client.interceptors.request.use(async (config) => {
        if (breaker.opened) {
            throw new ApiError(
                'Circuit breaker is open - too many failures',
                platform,
                503,
                'CIRCUIT_OPEN',
                false
            );
        }
        return config;
    });

    // Add response interceptor for error handling
    client.interceptors.response.use(
        (response) => response,
        async (error) => {
            const standardizedError = await handleApiError(error, platform);
            throw standardizedError;
        }
    );

    return client;
};

/**
 * Processes and standardizes API errors from different platforms
 * @param error Original error object
 * @param platform Platform type
 * @returns Standardized ApiError instance
 */
export const handleApiError = async (
    error: AxiosError | Error,
    platform: PlatformType
): Promise<ApiError> => {
    if (axios.isAxiosError(error)) {
        const statusCode = error.response?.status;
        const errorData = error.response?.data;

        // Platform-specific error handling
        if (platform === PlatformType.LINKEDIN) {
            const errorCode = errorData?.serviceErrorCode || ERROR_CODES[platform][statusCode || 0];
            const message = errorData?.message || error.message;
            const retryable = statusCode === 429 || (statusCode && statusCode >= 500);

            return new ApiError(message, platform, statusCode, errorCode, retryable);
        } else if (platform === PlatformType.GOOGLE) {
            const errorCode = errorData?.error?.code || ERROR_CODES[platform]['INTERNAL_ERROR'];
            const message = errorData?.error?.message || error.message;
            const retryable = errorCode === 'QUOTA_EXCEEDED' || errorCode === 'INTERNAL_ERROR';

            return new ApiError(message, platform, statusCode, errorCode, retryable);
        }
    }

    return new ApiError(
        error.message || 'Unknown error occurred',
        platform,
        500,
        'UNKNOWN_ERROR',
        false
    );
};

/**
 * Validates API response data against expected schema
 * @param response API response object
 * @param platform Platform type
 * @returns Boolean indicating validation success
 */
export const validateApiResponse = (
    response: any,
    platform: PlatformType
): boolean => {
    if (!response || typeof response !== 'object') {
        throw new ApiError('Invalid response format', platform, 400, 'INVALID_RESPONSE');
    }

    // Platform-specific validation
    if (platform === PlatformType.LINKEDIN) {
        if (response.elements && !Array.isArray(response.elements)) {
            throw new ApiError('Invalid LinkedIn response format', platform, 400, 'INVALID_RESPONSE');
        }
    } else if (platform === PlatformType.GOOGLE) {
        if (response.results && !Array.isArray(response.results)) {
            throw new ApiError('Invalid Google Ads response format', platform, 400, 'INVALID_RESPONSE');
        }
    }

    return true;
};

/**
 * Implements retry logic for failed API requests
 * @param requestFn Function to retry
 * @param retryConfig Retry configuration
 * @returns Promise resolving to API response
 */
export const retryRequest = async <T>(
    requestFn: () => Promise<T>,
    retryConfig: {
        maxRetries?: number;
        initialDelay?: number;
        maxDelay?: number;
        platform: PlatformType;
    }
): Promise<T> => {
    const {
        maxRetries = api.maxRetries,
        initialDelay = 1000,
        maxDelay = 32000,
        platform
    } = retryConfig;

    let attempt = 0;
    let delay = initialDelay;

    while (attempt < maxRetries) {
        try {
            return await requestFn();
        } catch (error) {
            attempt++;
            
            if (attempt === maxRetries) {
                throw new ApiError(
                    `Max retry attempts (${maxRetries}) reached`,
                    platform,
                    500,
                    'MAX_RETRIES_EXCEEDED'
                );
            }

            const apiError = await handleApiError(error as Error, platform);
            if (!apiError.retryable) {
                throw apiError;
            }

            // Exponential backoff with jitter
            delay = Math.min(delay * 2, maxDelay);
            const jitter = Math.random() * 100;
            await new Promise(resolve => setTimeout(resolve, delay + jitter));
        }
    }

    throw new ApiError(
        'Unexpected retry loop exit',
        platform,
        500,
        'RETRY_LOOP_ERROR'
    );
};