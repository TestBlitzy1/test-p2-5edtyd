import { format } from 'date-fns'; // ^2.30.0
import numeral from 'numeral'; // ^2.0.6
import * as Types from './types';
import { ApiError } from './api';

/**
 * Global constants for utility functions
 */
const DEFAULT_CURRENCY = 'USD';
const DEFAULT_DATE_FORMAT = "yyyy-MM-dd'T'HH:mm:ssxxx";
const DEFAULT_DECIMALS = 2;
const PERFORMANCE_THRESHOLDS = {
  CTR: 0.25, // 25% improvement target
  ROI: 0.30  // 30% ROI target
};
const ERROR_RETRY_ATTEMPTS = 3;
const METRIC_CACHE_DURATION = 300000; // 5 minutes

/**
 * Formats currency values with localization support
 * @param amount - Numeric amount to format
 * @param currencyCode - ISO currency code (default: USD)
 * @param localeOptions - Optional locale configuration
 * @returns Formatted currency string
 */
export function formatCurrency(
  amount: number,
  currencyCode: string = DEFAULT_CURRENCY,
  localeOptions?: Intl.NumberFormatOptions
): string {
  try {
    if (!isFinite(amount)) {
      throw new Error('Invalid amount provided');
    }

    const options: Intl.NumberFormatOptions = {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: DEFAULT_DECIMALS,
      maximumFractionDigits: DEFAULT_DECIMALS,
      ...localeOptions
    };

    return new Intl.NumberFormat(undefined, options).format(amount);
  } catch (error) {
    console.error('Currency formatting error:', error);
    return `${currencyCode} ${amount.toFixed(DEFAULT_DECIMALS)}`;
  }
}

/**
 * Formats date strings with timezone support
 * @param date - Date to format
 * @param formatString - Optional custom format string
 * @returns Formatted date string
 */
export function formatDate(
  date: Date | string | number,
  formatString: string = DEFAULT_DATE_FORMAT
): string {
  try {
    const dateObj = date instanceof Date ? date : new Date(date);
    return format(dateObj, formatString);
  } catch (error) {
    console.error('Date formatting error:', error);
    return String(date);
  }
}

/**
 * Formats percentage values with proper decimal handling
 * @param value - Number to format as percentage
 * @param decimals - Number of decimal places
 * @returns Formatted percentage string
 */
export function formatPercentage(
  value: number,
  decimals: number = DEFAULT_DECIMALS
): string {
  try {
    return numeral(value).format(`0.${'0'.repeat(decimals)}%`);
  } catch (error) {
    console.error('Percentage formatting error:', error);
    return `${(value * 100).toFixed(decimals)}%`;
  }
}

/**
 * Calculates and formats campaign performance metrics
 * Implements memoization for performance optimization
 * @param metrics - Campaign metrics object
 * @param platform - Platform type for platform-specific calculations
 * @returns Calculated and formatted performance metrics
 */
export function calculateCampaignMetrics(
  metrics: Types.CampaignMetrics,
  platform: Types.PlatformType
): Record<string, string | number> {
  const cache = new Map<string, Record<string, string | number>>();
  const cacheKey = `${JSON.stringify(metrics)}-${platform}`;

  if (cache.has(cacheKey)) {
    return cache.get(cacheKey)!;
  }

  try {
    const result = {
      ctr: metrics.clicks / metrics.impressions,
      cpc: metrics.spend / metrics.clicks,
      cpm: (metrics.spend / metrics.impressions) * 1000,
      conversionRate: metrics.conversions / metrics.clicks,
      roas: metrics.revenue / metrics.spend,
      roi: (metrics.revenue - metrics.spend) / metrics.spend,
      qualityScore: calculateQualityScore(metrics, platform),
      formattedCTR: formatPercentage(metrics.clicks / metrics.impressions),
      formattedCPC: formatCurrency(metrics.spend / metrics.clicks),
      formattedROI: formatPercentage((metrics.revenue - metrics.spend) / metrics.spend)
    };

    cache.set(cacheKey, result);
    setTimeout(() => cache.delete(cacheKey), METRIC_CACHE_DURATION);

    return result;
  } catch (error) {
    console.error('Metrics calculation error:', error);
    throw new ApiError('METRICS_CALCULATION_ERROR', 'Failed to calculate campaign metrics');
  }
}

/**
 * Calculates platform-specific quality score
 * @param metrics - Campaign metrics
 * @param platform - Platform type
 * @returns Quality score between 0 and 10
 */
function calculateQualityScore(
  metrics: Types.CampaignMetrics,
  platform: Types.PlatformType
): number {
  const weights = platform === Types.PlatformType.GOOGLE
    ? { ctr: 0.4, convRate: 0.4, relevance: 0.2 }
    : { ctr: 0.35, convRate: 0.35, relevance: 0.3 };

  const ctrScore = Math.min((metrics.clicks / metrics.impressions) / PERFORMANCE_THRESHOLDS.CTR, 1);
  const convScore = Math.min(metrics.conversions / metrics.clicks, 1);
  const relevanceScore = calculateRelevanceScore(metrics);

  return (
    (ctrScore * weights.ctr +
    convScore * weights.convRate +
    relevanceScore * weights.relevance) * 10
  );
}

/**
 * Calculates ad relevance score based on engagement metrics
 * @param metrics - Campaign metrics
 * @returns Relevance score between 0 and 1
 */
function calculateRelevanceScore(metrics: Types.CampaignMetrics): number {
  const engagementRate = metrics.engagements / metrics.impressions;
  const bounceRate = metrics.bounces / metrics.clicks;
  const avgTimeOnSite = metrics.totalTimeOnSite / metrics.clicks;

  return Math.min(
    (engagementRate * 0.4 +
    (1 - bounceRate) * 0.3 +
    Math.min(avgTimeOnSite / 120, 1) * 0.3),
    1
  );
}

/**
 * Validates campaign budget against platform limits
 * @param amount - Budget amount
 * @param platform - Platform type
 * @returns Validation result with optional error message
 */
export function validateCampaignBudget(
  amount: number,
  platform: Types.PlatformType
): { isValid: boolean; error?: string } {
  const limits = {
    [Types.PlatformType.LINKEDIN]: { min: 10, max: 50000 },
    [Types.PlatformType.GOOGLE]: { min: 5, max: 100000 }
  };

  const { min, max } = limits[platform];

  if (amount < min) {
    return { isValid: false, error: `Minimum budget for ${platform} is ${formatCurrency(min)}` };
  }

  if (amount > max) {
    return { isValid: false, error: `Maximum budget for ${platform} is ${formatCurrency(max)}` };
  }

  return { isValid: true };
}

/**
 * Checks if campaign performance meets target thresholds
 * @param metrics - Campaign metrics
 * @returns Performance status with recommendations
 */
export function checkCampaignPerformance(
  metrics: Types.CampaignMetrics
): { status: Types.LoadingState; recommendations: string[] } {
  const recommendations: string[] = [];
  let status = Types.LoadingState.SUCCESS;

  const ctr = metrics.clicks / metrics.impressions;
  const roi = (metrics.revenue - metrics.spend) / metrics.spend;

  if (ctr < PERFORMANCE_THRESHOLDS.CTR) {
    recommendations.push('Consider revising ad copy to improve CTR');
    status = Types.LoadingState.ERROR;
  }

  if (roi < PERFORMANCE_THRESHOLDS.ROI) {
    recommendations.push('Optimize targeting to improve ROI');
    status = Types.LoadingState.ERROR;
  }

  return { status, recommendations };
}