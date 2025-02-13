/**
 * Common type definitions for the Sales Intelligence Platform
 * Provides shared types, interfaces, and utility types used across the frontend application
 * @version 1.0.0
 */

import { ReactNode } from 'react'; // ^18.0.0
import { MetricType } from './analytics';
import { UserRole } from './auth';

/**
 * Common status enum for various entities
 */
export enum Status {
    ACTIVE = 'ACTIVE',
    INACTIVE = 'INACTIVE',
    PENDING = 'PENDING',
    ERROR = 'ERROR'
}

/**
 * Common size enum for UI components
 */
export enum Size {
    SMALL = 'SMALL',
    MEDIUM = 'MEDIUM',
    LARGE = 'LARGE'
}

/**
 * Common variant enum for UI styling
 */
export enum Variant {
    PRIMARY = 'PRIMARY',
    SECONDARY = 'SECONDARY',
    TERTIARY = 'TERTIARY'
}

/**
 * Base props interface for React components
 */
export interface BaseComponentProps {
    /** Optional CSS class name */
    className?: string;
    /** React children nodes */
    children?: ReactNode;
    /** Optional component ID */
    id?: string;
}

/**
 * Standard API error interface
 */
export interface ApiError {
    /** Error code identifier */
    code: string;
    /** Human-readable error message */
    message: string;
    /** Additional error details */
    details?: Record<string, any>;
}

/**
 * Common pagination parameters interface
 */
export interface PaginationParams {
    /** Current page number (1-based) */
    page: number;
    /** Number of items per page */
    limit: number;
    /** Field to sort by */
    sortBy?: string;
    /** Sort direction */
    sortOrder?: 'asc' | 'desc';
}

/**
 * Date range interface for filtering
 */
export interface DateRange {
    /** Start date of the range */
    startDate: Date;
    /** End date of the range */
    endDate: Date;
}

/**
 * Type guard for checking valid date range
 */
export function isValidDateRange(range: any): range is DateRange {
    return (
        range &&
        range.startDate instanceof Date &&
        range.endDate instanceof Date &&
        range.startDate <= range.endDate
    );
}

/**
 * Type guard for checking valid pagination parameters
 */
export function isValidPaginationParams(params: any): params is PaginationParams {
    return (
        params &&
        typeof params.page === 'number' &&
        params.page >= 1 &&
        typeof params.limit === 'number' &&
        params.limit >= 1
    );
}

/**
 * Utility type for making specific properties required
 */
export type RequiredProps<T, K extends keyof T> = T & Required<Pick<T, K>>;

/**
 * Utility type for making specific properties optional
 */
export type OptionalProps<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Utility type for readonly properties
 */
export type ReadonlyProps<T> = {
    readonly [P in keyof T]: T[P];
};

/**
 * Utility type for deep partial objects
 */
export type DeepPartial<T> = {
    [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Common loading state interface
 */
export interface LoadingState {
    loading: boolean;
    error?: ApiError;
}

/**
 * Common success response interface
 */
export interface SuccessResponse<T> {
    data: T;
    message?: string;
}

/**
 * Common error response interface
 */
export interface ErrorResponse {
    error: ApiError;
}

/**
 * Type guard for success response
 */
export function isSuccessResponse<T>(response: any): response is SuccessResponse<T> {
    return response && 'data' in response;
}

/**
 * Type guard for error response
 */
export function isErrorResponse(response: any): response is ErrorResponse {
    return response && 'error' in response && 'code' in response.error;
}