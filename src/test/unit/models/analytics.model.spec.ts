import { Pool } from 'pg';  // ^8.11.0
import { StatsD } from 'hot-shots';  // ^9.3.0
import { MetricsModel } from '../../../backend/analytics-service/src/models/metrics.model';
import { MetricType, IMetric } from '../../../backend/shared/types/analytics.types';

// Mock implementations
jest.mock('pg');
jest.mock('hot-shots');

describe('MetricsModel', () => {
    let metricsModel: MetricsModel;
    let mockPool: jest.Mocked<Pool>;
    let mockStatsD: jest.Mocked<StatsD>;
    let mockTimer: { end: jest.Mock };

    // Test data factories
    const createTestMetric = (type: MetricType = MetricType.IMPRESSIONS): IMetric => ({
        type,
        value: type === MetricType.CTR ? 2.5 : 1000,
        timestamp: new Date(),
        platform: 'LINKEDIN',
        segmentId: 'test-segment'
    });

    const createTestCampaignId = (): string => 'test-campaign-id';

    beforeEach(() => {
        // Reset mocks
        mockPool = {
            query: jest.fn(),
            connect: jest.fn(),
            end: jest.fn(),
            on: jest.fn(),
        } as unknown as jest.Mocked<Pool>;

        mockTimer = { end: jest.fn() };
        mockStatsD = {
            startTimer: jest.fn().mockReturnValue(mockTimer),
            increment: jest.fn(),
            gauge: jest.fn(),
        } as unknown as jest.Mocked<StatsD>;

        metricsModel = new MetricsModel(mockPool, mockStatsD);
    });

    describe('create', () => {
        it('should successfully create a new metric', async () => {
            const testMetric = createTestMetric();
            const campaignId = createTestCampaignId();
            const mockQueryResult = {
                rows: [{
                    metric_type: testMetric.type,
                    value: testMetric.value,
                    timestamp: testMetric.timestamp
                }]
            };

            mockPool.query.mockResolvedValueOnce(mockQueryResult);

            const result = await metricsModel.create(testMetric, campaignId);

            expect(mockPool.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO campaign_metrics'),
                [campaignId, testMetric.type, testMetric.value, testMetric.timestamp]
            );
            expect(result).toEqual(testMetric);
            expect(mockStatsD.increment).toHaveBeenCalledWith('metrics.create.success');
            expect(mockTimer.end).toHaveBeenCalled();
        });

        it('should handle validation errors', async () => {
            const invalidMetric = { ...createTestMetric(), value: -1 };
            const campaignId = createTestCampaignId();

            await expect(metricsModel.create(invalidMetric, campaignId))
                .rejects.toThrow();
            expect(mockStatsD.increment).toHaveBeenCalledWith('metrics.create.error');
            expect(mockTimer.end).toHaveBeenCalled();
        });
    });

    describe('findByCampaignId', () => {
        const startDate = new Date('2023-01-01');
        const endDate = new Date('2023-01-31');

        it('should retrieve metrics with cache miss', async () => {
            const campaignId = createTestCampaignId();
            const mockMetrics = [createTestMetric(), createTestMetric(MetricType.CLICKS)];
            mockPool.query.mockResolvedValueOnce({ rows: mockMetrics.map(m => ({
                metric_type: m.type,
                value: m.value,
                timestamp: m.timestamp
            }))});

            const result = await metricsModel.findByCampaignId(campaignId, startDate, endDate);

            expect(mockPool.query).toHaveBeenCalledWith(
                expect.stringContaining('SELECT * FROM campaign_metrics'),
                [campaignId, startDate, endDate]
            );
            expect(result).toHaveLength(mockMetrics.length);
            expect(mockStatsD.increment).toHaveBeenCalledWith('metrics.find.success');
        });

        it('should return cached metrics on cache hit', async () => {
            const campaignId = createTestCampaignId();
            const mockMetrics = [createTestMetric()];

            // Prime the cache
            mockPool.query.mockResolvedValueOnce({ rows: mockMetrics.map(m => ({
                metric_type: m.type,
                value: m.value,
                timestamp: m.timestamp
            }))});

            await metricsModel.findByCampaignId(campaignId, startDate, endDate);
            const result = await metricsModel.findByCampaignId(campaignId, startDate, endDate);

            expect(mockPool.query).toHaveBeenCalledTimes(1);
            expect(result).toHaveLength(mockMetrics.length);
            expect(mockStatsD.increment).toHaveBeenCalledWith('metrics.cache.hit');
        });
    });

    describe('aggregateByType', () => {
        const startDate = new Date('2023-01-01');
        const endDate = new Date('2023-01-31');

        it('should calculate metric aggregation with trends', async () => {
            const campaignId = createTestCampaignId();
            const mockResult = {
                rows: [{
                    current_value: 1000,
                    trend: 25.5
                }]
            };

            mockPool.query.mockResolvedValueOnce(mockResult);

            const result = await metricsModel.aggregateByType(
                campaignId,
                MetricType.IMPRESSIONS,
                startDate,
                endDate
            );

            expect(mockPool.query).toHaveBeenCalledWith(
                expect.stringContaining('WITH current_period'),
                [campaignId, MetricType.IMPRESSIONS, startDate, endDate]
            );
            expect(result).toEqual({
                value: 1000,
                trend: 25.5
            });
            expect(mockStatsD.increment).toHaveBeenCalledWith('metrics.aggregate.success');
        });

        it('should handle null aggregation results', async () => {
            const campaignId = createTestCampaignId();
            mockPool.query.mockResolvedValueOnce({ rows: [{}] });

            const result = await metricsModel.aggregateByType(
                campaignId,
                MetricType.CLICKS,
                startDate,
                endDate
            );

            expect(result).toEqual({
                value: 0,
                trend: 0
            });
        });
    });

    describe('batchInsert', () => {
        it('should handle batch insertion with transaction', async () => {
            const metrics = [
                createTestMetric(MetricType.IMPRESSIONS),
                createTestMetric(MetricType.CLICKS)
            ];
            const campaignId = createTestCampaignId();
            const mockClient = {
                query: jest.fn(),
                release: jest.fn()
            };

            mockPool.connect.mockResolvedValueOnce(mockClient as any);
            mockClient.query.mockResolvedValue({});

            await metricsModel.batchInsert(metrics, campaignId);

            expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
            expect(mockClient.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO campaign_metrics'),
                expect.arrayContaining([campaignId])
            );
            expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
            expect(mockStatsD.increment).toHaveBeenCalledWith('metrics.batchInsert.success');
            expect(mockStatsD.gauge).toHaveBeenCalledWith('metrics.batchSize', metrics.length);
        });

        it('should rollback transaction on error', async () => {
            const metrics = [createTestMetric()];
            const campaignId = createTestCampaignId();
            const mockClient = {
                query: jest.fn(),
                release: jest.fn()
            };

            mockPool.connect.mockResolvedValueOnce(mockClient as any);
            mockClient.query.mockRejectedValueOnce(new Error('Database error'));

            await expect(metricsModel.batchInsert(metrics, campaignId))
                .rejects.toThrow('Database error');

            expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
            expect(mockStatsD.increment).toHaveBeenCalledWith('metrics.batchInsert.error');
            expect(mockClient.release).toHaveBeenCalled();
        });
    });
});