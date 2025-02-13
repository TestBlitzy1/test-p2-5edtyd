import { 
    calculateCTR, 
    calculateCPC, 
    calculateROAS, 
    aggregateMetrics,
    formatMetricValue 
} from '../../../backend/shared/utils/metrics';
import { MetricType } from '../../../backend/shared/types/analytics.types';
import { generateTestMetrics } from '../../utils/test.helpers';

describe('Metrics Utility Functions', () => {
    describe('calculateCTR', () => {
        it('should calculate CTR correctly with valid inputs', () => {
            const clicks = 100;
            const impressions = 1000;
            const expectedCTR = 10.0000; // 10% with 4 decimal precision

            const result = calculateCTR(clicks, impressions);
            expect(result).toBe(expectedCTR);
        });

        it('should handle zero impressions', () => {
            const clicks = 0;
            const impressions = 0;
            
            const result = calculateCTR(clicks, impressions);
            expect(result).toBe(0);
        });

        it('should throw error for negative values', () => {
            expect(() => calculateCTR(-1, 100)).toThrow('Clicks and impressions must be non-negative');
            expect(() => calculateCTR(100, -1)).toThrow('Clicks and impressions must be non-negative');
        });

        it('should maintain precision for small values', () => {
            const clicks = 1;
            const impressions = 10000;
            const result = calculateCTR(clicks, impressions);
            expect(result).toBe(0.0100); // 0.01% with 4 decimal precision
        });

        it('should handle large numbers without overflow', () => {
            const clicks = 1000000;
            const impressions = 10000000;
            const result = calculateCTR(clicks, impressions);
            expect(result).toBe(10.0000);
        });
    });

    describe('calculateCPC', () => {
        it('should calculate CPC correctly with valid inputs', () => {
            const cost = 1000;
            const clicks = 100;
            const expectedCPC = 10.0000;

            const result = calculateCPC(cost, clicks);
            expect(result).toBe(expectedCPC);
        });

        it('should handle zero clicks', () => {
            const cost = 1000;
            const clicks = 0;
            
            const result = calculateCPC(cost, clicks);
            expect(result).toBe(0);
        });

        it('should throw error for negative values', () => {
            expect(() => calculateCPC(-1, 100)).toThrow('Cost and clicks must be non-negative');
            expect(() => calculateCPC(100, -1)).toThrow('Cost and clicks must be non-negative');
        });

        it('should maintain precision for fractional costs', () => {
            const cost = 10.55;
            const clicks = 5;
            const result = calculateCPC(cost, clicks);
            expect(result).toBe(2.1100);
        });

        it('should handle high-cost campaigns', () => {
            const cost = 1000000;
            const clicks = 1000;
            const result = calculateCPC(cost, clicks);
            expect(result).toBe(1000.0000);
        });
    });

    describe('calculateROAS', () => {
        it('should calculate ROAS correctly with valid inputs', () => {
            const revenue = 2000;
            const cost = 1000;
            const expectedROAS = 2.0000;

            const result = calculateROAS(revenue, cost);
            expect(result).toBe(expectedROAS);
        });

        it('should handle zero cost', () => {
            const revenue = 1000;
            const cost = 0;
            
            const result = calculateROAS(revenue, cost);
            expect(result).toBe(0);
        });

        it('should throw error for negative values', () => {
            expect(() => calculateROAS(-1, 100)).toThrow('Revenue and cost must be non-negative');
            expect(() => calculateROAS(100, -1)).toThrow('Revenue and cost must be non-negative');
        });

        it('should maintain precision for high ROAS values', () => {
            const revenue = 100000;
            const cost = 1000;
            const result = calculateROAS(revenue, cost);
            expect(result).toBe(100.0000);
        });

        it('should handle fractional values correctly', () => {
            const revenue = 155.55;
            const cost = 100.00;
            const result = calculateROAS(revenue, cost);
            expect(result).toBe(1.5555);
        });
    });

    describe('aggregateMetrics', () => {
        const startDate = new Date('2024-01-01');
        const endDate = new Date('2024-01-31');
        
        it('should aggregate sum-based metrics correctly', () => {
            const metrics = [
                { type: MetricType.IMPRESSIONS, value: 1000, timestamp: new Date('2024-01-15') },
                { type: MetricType.IMPRESSIONS, value: 2000, timestamp: new Date('2024-01-16') }
            ];

            const result = aggregateMetrics(metrics, MetricType.IMPRESSIONS, startDate, endDate);
            expect(result).toBe(3000);
        });

        it('should aggregate average-based metrics correctly', () => {
            const metrics = [
                { type: MetricType.CTR, value: 2.5, timestamp: new Date('2024-01-15') },
                { type: MetricType.CTR, value: 3.5, timestamp: new Date('2024-01-16') }
            ];

            const result = aggregateMetrics(metrics, MetricType.CTR, startDate, endDate);
            expect(result).toBe(3.0000);
        });

        it('should return 0 for empty metrics array', () => {
            const result = aggregateMetrics([], MetricType.IMPRESSIONS, startDate, endDate);
            expect(result).toBe(0);
        });

        it('should filter metrics by date range', () => {
            const metrics = [
                { type: MetricType.IMPRESSIONS, value: 1000, timestamp: new Date('2023-12-31') },
                { type: MetricType.IMPRESSIONS, value: 2000, timestamp: new Date('2024-01-15') },
                { type: MetricType.IMPRESSIONS, value: 3000, timestamp: new Date('2024-02-01') }
            ];

            const result = aggregateMetrics(metrics, MetricType.IMPRESSIONS, startDate, endDate);
            expect(result).toBe(2000);
        });

        it('should throw error for invalid metric type', () => {
            const metrics = [
                { type: 'INVALID' as MetricType, value: 1000, timestamp: new Date('2024-01-15') }
            ];

            expect(() => aggregateMetrics(metrics, 'INVALID' as MetricType, startDate, endDate))
                .toThrow('Unsupported metric type: INVALID');
        });
    });

    describe('formatMetricValue', () => {
        it('should format percentage metrics correctly', () => {
            const result = formatMetricValue(2.5678, MetricType.CTR);
            expect(result).toBe('2.5678%');
        });

        it('should format currency metrics correctly', () => {
            expect(formatMetricValue(10.5678, MetricType.COST)).toBe('$10.5678');
            expect(formatMetricValue(2.5678, MetricType.CPC)).toBe('$2.5678');
            expect(formatMetricValue(15.5678, MetricType.CPM)).toBe('$15.5678');
        });

        it('should format ratio metrics correctly', () => {
            const result = formatMetricValue(3.5678, MetricType.ROAS);
            expect(result).toBe('3.5678x');
        });

        it('should format count metrics with locale string', () => {
            expect(formatMetricValue(1000, MetricType.IMPRESSIONS)).toBe('1,000');
            expect(formatMetricValue(2500, MetricType.CLICKS)).toBe('2,500');
            expect(formatMetricValue(150, MetricType.CONVERSIONS)).toBe('150');
        });

        it('should maintain precision for all metric types', () => {
            const value = 123.4567;
            const types = Object.values(MetricType);
            
            types.forEach(type => {
                const result = formatMetricValue(value, type);
                expect(result).toMatch(/123\.4567/);
            });
        });
    });
});