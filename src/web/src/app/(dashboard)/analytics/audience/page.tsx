'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useSelector } from 'react-redux';
import clsx from 'clsx';
import { ErrorBoundary } from 'react-error-boundary';

import CampaignMetrics from '@/components/analytics/CampaignMetrics';
import TargetingEditor from '@/components/campaigns/TargetingEditor';
import useAnalytics from '@/hooks/useAnalytics';
import { TimeRange, MetricType } from '@/types/analytics';
import { PlatformType } from '@/types/platform';
import { Card } from '@/components/common/Card';
import { Size, Variant } from '@/types/common';

// Constants for analytics configuration
const REFRESH_INTERVAL = 30000; // 30 seconds
const DEFAULT_METRICS = [
  MetricType.IMPRESSIONS,
  MetricType.CLICKS,
  MetricType.CTR,
  MetricType.CONVERSIONS,
  MetricType.CONVERSION_RATE,
  MetricType.COST,
  MetricType.CPC,
  MetricType.ROAS
];

interface AudienceSegment {
  id: string;
  name: string;
  size: number;
  engagement: number;
  conversion: number;
}

interface AudienceInsight {
  type: 'demographic' | 'behavioral' | 'performance';
  title: string;
  description: string;
  confidence: number;
  impact: 'high' | 'medium' | 'low';
}

const AudienceAnalyticsPage: React.FC = () => {
  // State management
  const [selectedTimeRange, setTimeRange] = useState<TimeRange>(TimeRange.LAST_30_DAYS);
  const [selectedPlatform, setPlatform] = useState<PlatformType>(PlatformType.LINKEDIN);
  const [activeSegments, setActiveSegments] = useState<string[]>([]);

  // Custom hooks for analytics data
  const {
    data: analyticsData,
    loading,
    error,
    isStale,
    refetch,
    lastUpdated
  } = useAnalytics('all', selectedTimeRange, {
    pollingInterval: REFRESH_INTERVAL,
    metrics: DEFAULT_METRICS
  });

  // Memoized audience segments
  const audienceSegments = useMemo<AudienceSegment[]>(() => {
    if (!analyticsData?.metrics) return [];
    
    return analyticsData.segments.map(segment => ({
      id: segment,
      name: segment,
      size: analyticsData.metrics.find(m => m.segment === segment && m.type === MetricType.IMPRESSIONS)?.value || 0,
      engagement: analyticsData.metrics.find(m => m.segment === segment && m.type === MetricType.CTR)?.value || 0,
      conversion: analyticsData.metrics.find(m => m.segment === segment && m.type === MetricType.CONVERSION_RATE)?.value || 0
    }));
  }, [analyticsData]);

  // Generate AI-powered audience insights
  const audienceInsights = useMemo<AudienceInsight[]>(() => {
    if (!analyticsData) return [];

    const insights: AudienceInsight[] = [];
    const metrics = analyticsData.metrics;

    // Analyze demographic performance
    const topPerformingSegments = audienceSegments
      .sort((a, b) => b.conversion - a.conversion)
      .slice(0, 3);

    if (topPerformingSegments.length > 0) {
      insights.push({
        type: 'demographic',
        title: 'Top Performing Segments',
        description: `${topPerformingSegments[0].name} shows highest conversion rate at ${(topPerformingSegments[0].conversion * 100).toFixed(1)}%`,
        confidence: 0.92,
        impact: 'high'
      });
    }

    // Analyze engagement patterns
    const avgEngagement = audienceSegments.reduce((sum, seg) => sum + seg.engagement, 0) / audienceSegments.length;
    if (avgEngagement > 0.05) {
      insights.push({
        type: 'behavioral',
        title: 'Strong Engagement Metrics',
        description: `Average CTR of ${(avgEngagement * 100).toFixed(1)}% indicates strong audience relevance`,
        confidence: 0.85,
        impact: 'medium'
      });
    }

    return insights;
  }, [analyticsData, audienceSegments]);

  // Handle segment selection
  const handleSegmentSelect = useCallback((segmentId: string) => {
    setActiveSegments(prev => 
      prev.includes(segmentId) 
        ? prev.filter(id => id !== segmentId)
        : [...prev, segmentId]
    );
  }, []);

  // Error handler for ErrorBoundary
  const handleError = useCallback((error: Error) => {
    console.error('Audience Analytics Error:', error);
  }, []);

  return (
    <ErrorBoundary
      FallbackComponent={({ error }) => (
        <Card 
          title="Error"
          variant={Variant.TERTIARY}
          size={Size.LARGE}
          className="bg-red-50"
        >
          <p className="text-red-600">Failed to load audience analytics: {error.message}</p>
        </Card>
      )}
      onError={handleError}
    >
      <div className="space-y-6">
        {/* Header Section */}
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-semibold">Audience Analytics</h1>
          <div className="flex items-center space-x-4">
            <select
              value={selectedTimeRange}
              onChange={(e) => setTimeRange(e.target.value as TimeRange)}
              className="rounded-md border-gray-300"
            >
              {Object.values(TimeRange).map(range => (
                <option key={range} value={range}>
                  {range.replace('_', ' ')}
                </option>
              ))}
            </select>
            <button
              onClick={() => refetch()}
              className={clsx(
                'p-2 rounded-md',
                'text-blue-600 hover:bg-blue-50',
                'transition-colors duration-200',
                { 'animate-spin': loading }
              )}
              disabled={loading}
            >
              ↻
            </button>
          </div>
        </div>

        {/* Main Analytics Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Metrics Overview */}
          <div className="lg:col-span-2">
            <CampaignMetrics
              campaignId="all"
              timeRange={selectedTimeRange}
              refreshInterval={REFRESH_INTERVAL}
              showTrends
              displayConfig={{
                showConfidenceIntervals: true,
                virtualizeThreshold: 10
              }}
              errorConfig={{
                fallback: <div>Error loading metrics</div>,
                onReset: refetch
              }}
            />
          </div>

          {/* Audience Insights */}
          <div className="space-y-6">
            <Card
              title="AI Insights"
              variant={Variant.PRIMARY}
              size={Size.LARGE}
            >
              <div className="space-y-4">
                {audienceInsights.map((insight, index) => (
                  <div
                    key={index}
                    className={clsx(
                      'p-4 rounded-md',
                      'border-l-4',
                      {
                        'border-blue-500 bg-blue-50': insight.type === 'demographic',
                        'border-green-500 bg-green-50': insight.type === 'behavioral',
                        'border-purple-500 bg-purple-50': insight.type === 'performance'
                      }
                    )}
                  >
                    <h3 className="font-semibold">{insight.title}</h3>
                    <p className="text-sm mt-1">{insight.description}</p>
                    <div className="flex justify-between mt-2 text-xs text-gray-500">
                      <span>Confidence: {(insight.confidence * 100).toFixed(0)}%</span>
                      <span className={clsx(
                        'px-2 py-1 rounded-full',
                        {
                          'bg-red-100 text-red-800': insight.impact === 'high',
                          'bg-yellow-100 text-yellow-800': insight.impact === 'medium',
                          'bg-green-100 text-green-800': insight.impact === 'low'
                        }
                      )}>
                        {insight.impact.toUpperCase()} IMPACT
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Audience Targeting Recommendations */}
            <TargetingEditor
              campaignId="all"
              initialTargeting={analyticsData?.targeting || {
                locations: [],
                industries: [],
                companySize: [],
                jobTitles: []
              }}
              platform={selectedPlatform}
              onChange={() => {}}
              onError={handleError}
              showAISuggestions
            />
          </div>
        </div>

        {/* Data Freshness Indicator */}
        {lastUpdated && (
          <div className={clsx(
            'text-sm text-gray-500 mt-4',
            { 'text-amber-500': isStale }
          )}>
            Last updated: {lastUpdated.toLocaleTimeString()}
            {isStale && ' (Data may be stale)'}
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
};

export default AudienceAnalyticsPage;