import { ICampaign, PlatformType, CampaignStatus } from '../../backend/shared/types/campaign.types';
import { jest } from '@jest/globals';

/**
 * Mock implementation of LinkedIn Ads service for testing
 * @version 1.0.0
 */
export class MockLinkedInService {
    private campaigns: Map<string, ICampaign>;
    private createCampaignMock: jest.Mock;
    private updateCampaignMock: jest.Mock;
    private getCampaignMock: jest.Mock;
    private deleteCampaignMock: jest.Mock;
    private pauseCampaignMock: jest.Mock;
    private mockDelay: number;

    constructor(mockDelay: number = 100) {
        this.campaigns = new Map<string, ICampaign>();
        this.mockDelay = mockDelay;

        // Initialize mock functions
        this.createCampaignMock = jest.fn();
        this.updateCampaignMock = jest.fn();
        this.getCampaignMock = jest.fn();
        this.deleteCampaignMock = jest.fn();
        this.pauseCampaignMock = jest.fn();
    }

    /**
     * Simulates campaign creation on LinkedIn Ads
     * @param campaign Campaign configuration to create
     * @throws Error if platform type is invalid or required fields are missing
     */
    async createCampaign(campaign: ICampaign): Promise<string> {
        await this.simulateDelay();
        
        if (campaign.platform !== PlatformType.LINKEDIN) {
            throw new Error('Invalid platform type for LinkedIn campaign');
        }

        // Validate required campaign fields
        if (!campaign.name || !campaign.budget || !campaign.targeting) {
            throw new Error('Missing required campaign fields');
        }

        const campaignId = `li_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.campaigns.set(campaignId, {
            ...campaign,
            id: campaignId,
            status: CampaignStatus.PENDING_APPROVAL,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        this.createCampaignMock(campaign);
        return campaignId;
    }

    /**
     * Simulates campaign update operation
     * @param campaignId Campaign identifier
     * @param updates Campaign field updates
     */
    async updateCampaign(campaignId: string, updates: Partial<ICampaign>): Promise<void> {
        await this.simulateDelay();

        if (!this.campaigns.has(campaignId)) {
            throw new Error('Campaign not found');
        }

        const existingCampaign = this.campaigns.get(campaignId)!;
        this.campaigns.set(campaignId, {
            ...existingCampaign,
            ...updates,
            updatedAt: new Date()
        });

        this.updateCampaignMock(campaignId, updates);
    }

    /**
     * Simulates campaign retrieval
     * @param campaignId Campaign identifier
     */
    async getCampaign(campaignId: string): Promise<ICampaign> {
        await this.simulateDelay();

        const campaign = this.campaigns.get(campaignId);
        if (!campaign) {
            throw new Error('Campaign not found');
        }

        this.getCampaignMock(campaignId);
        return campaign;
    }

    /**
     * Simulates campaign deletion
     * @param campaignId Campaign identifier
     */
    async deleteCampaign(campaignId: string): Promise<void> {
        await this.simulateDelay();

        if (!this.campaigns.has(campaignId)) {
            throw new Error('Campaign not found');
        }

        this.campaigns.delete(campaignId);
        this.deleteCampaignMock(campaignId);
    }

    /**
     * Simulates campaign pause operation
     * @param campaignId Campaign identifier
     */
    async pauseCampaign(campaignId: string): Promise<void> {
        await this.simulateDelay();

        if (!this.campaigns.has(campaignId)) {
            throw new Error('Campaign not found');
        }

        const campaign = this.campaigns.get(campaignId)!;
        this.campaigns.set(campaignId, {
            ...campaign,
            status: CampaignStatus.PAUSED,
            updatedAt: new Date()
        });

        this.pauseCampaignMock(campaignId);
    }

    private async simulateDelay(): Promise<void> {
        await new Promise(resolve => setTimeout(resolve, this.mockDelay));
    }
}

/**
 * Mock implementation of Google Ads service for testing
 * @version 1.0.0
 */
export class MockGoogleAdsService {
    private campaigns: Map<string, ICampaign>;
    private createCampaignMock: jest.Mock;
    private updateCampaignMock: jest.Mock;
    private getCampaignPerformanceMock: jest.Mock;
    private pauseCampaignMock: jest.Mock;
    private mockDelay: number;

    constructor(mockDelay: number = 100) {
        this.campaigns = new Map<string, ICampaign>();
        this.mockDelay = mockDelay;

        // Initialize mock functions
        this.createCampaignMock = jest.fn();
        this.updateCampaignMock = jest.fn();
        this.getCampaignPerformanceMock = jest.fn();
        this.pauseCampaignMock = jest.fn();
    }

    /**
     * Simulates campaign creation on Google Ads
     * @param campaign Campaign configuration to create
     * @throws Error if platform type is invalid or required fields are missing
     */
    async createCampaign(campaign: ICampaign): Promise<string> {
        await this.simulateDelay();

        if (campaign.platform !== PlatformType.GOOGLE) {
            throw new Error('Invalid platform type for Google Ads campaign');
        }

        // Validate required campaign fields
        if (!campaign.name || !campaign.budget || !campaign.targeting) {
            throw new Error('Missing required campaign fields');
        }

        const campaignId = `ga_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.campaigns.set(campaignId, {
            ...campaign,
            id: campaignId,
            status: CampaignStatus.PENDING_APPROVAL,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        this.createCampaignMock(campaign);
        return campaignId;
    }

    /**
     * Simulates campaign update operation
     * @param campaignId Campaign identifier
     * @param updates Campaign field updates
     */
    async updateCampaign(campaignId: string, updates: Partial<ICampaign>): Promise<void> {
        await this.simulateDelay();

        if (!this.campaigns.has(campaignId)) {
            throw new Error('Campaign not found');
        }

        const existingCampaign = this.campaigns.get(campaignId)!;
        this.campaigns.set(campaignId, {
            ...existingCampaign,
            ...updates,
            updatedAt: new Date()
        });

        this.updateCampaignMock(campaignId, updates);
    }

    /**
     * Simulates campaign performance metrics retrieval
     * @param campaignId Campaign identifier
     */
    async getCampaignPerformance(campaignId: string): Promise<object> {
        await this.simulateDelay();

        if (!this.campaigns.has(campaignId)) {
            throw new Error('Campaign not found');
        }

        // Generate mock performance metrics
        const mockMetrics = {
            impressions: Math.floor(Math.random() * 10000),
            clicks: Math.floor(Math.random() * 1000),
            ctr: Math.random() * 0.1,
            conversions: Math.floor(Math.random() * 100),
            cost: Math.random() * 1000,
            averageCpc: Math.random() * 2,
            averagePosition: Math.random() * 4 + 1
        };

        this.getCampaignPerformanceMock(campaignId);
        return mockMetrics;
    }

    /**
     * Simulates campaign pause operation
     * @param campaignId Campaign identifier
     */
    async pauseCampaign(campaignId: string): Promise<void> {
        await this.simulateDelay();

        if (!this.campaigns.has(campaignId)) {
            throw new Error('Campaign not found');
        }

        const campaign = this.campaigns.get(campaignId)!;
        this.campaigns.set(campaignId, {
            ...campaign,
            status: CampaignStatus.PAUSED,
            updatedAt: new Date()
        });

        this.pauseCampaignMock(campaignId);
    }

    private async simulateDelay(): Promise<void> {
        await new Promise(resolve => setTimeout(resolve, this.mockDelay));
    }
}