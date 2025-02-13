// External imports
import axios, { AxiosInstance } from 'axios'; // ^1.6.0
import CircuitBreaker from 'circuit-breaker-js'; // ^0.1.0

// Internal imports
import { createApiClient, handleApiError, retryRequest } from '../utils/api.utils';
import { ICampaign, PlatformType, CampaignStatus, IAdGroup } from '../../../shared/types/campaign.types';
import { platforms } from '../config';

/**
 * Configuration interface for LinkedIn API service
 */
interface LinkedInServiceConfig {
    maxRetries?: number;
    timeout?: number;
    circuitBreaker?: {
        failureThreshold: number;
        resetTimeout: number;
    };
}

/**
 * Enhanced service class for LinkedIn Ads platform integration with comprehensive
 * error handling, retry mechanisms, and circuit breaker pattern
 */
export class LinkedInService {
    private apiClient: AxiosInstance;
    private readonly accountId: string;
    private readonly circuitBreaker: CircuitBreaker;
    private readonly maxRetries: number;

    constructor(accountId: string, config: LinkedInServiceConfig = {}) {
        this.accountId = accountId;
        this.maxRetries = config.maxRetries || platforms[PlatformType.LINKEDIN].retryAttempts;

        // Initialize API client with enhanced error handling
        this.apiClient = createApiClient(PlatformType.LINKEDIN, {
            timeout: config.timeout || platforms[PlatformType.LINKEDIN].timeout
        });

        // Configure circuit breaker
        this.circuitBreaker = new CircuitBreaker({
            failureThreshold: config.circuitBreaker?.failureThreshold || 5,
            resetTimeout: config.circuitBreaker?.resetTimeout || 30000
        });
    }

    /**
     * Creates a new LinkedIn advertising campaign with enhanced validation and error handling
     */
    async createCampaign(campaign: ICampaign): Promise<string> {
        try {
            // Transform campaign data to LinkedIn API format
            const linkedInCampaign = this.transformCampaignData(campaign);

            // Execute request with retry and circuit breaker
            const response = await retryRequest(
                async () => {
                    return await this.circuitBreaker.execute(async () => {
                        const result = await this.apiClient.post(
                            `/v2/adAccounts/${this.accountId}/campaigns`,
                            linkedInCampaign
                        );
                        return result.data;
                    });
                },
                { platform: PlatformType.LINKEDIN, maxRetries: this.maxRetries }
            );

            // Create associated ad groups
            await this.createAdGroups(response.id, campaign.adGroups);

            return response.id;
        } catch (error) {
            throw await handleApiError(error as Error, PlatformType.LINKEDIN);
        }
    }

    /**
     * Updates an existing LinkedIn campaign with comprehensive error handling
     */
    async updateCampaign(campaignId: string, campaign: Partial<ICampaign>): Promise<void> {
        try {
            const linkedInCampaign = this.transformCampaignData(campaign, true);

            await retryRequest(
                async () => {
                    return await this.circuitBreaker.execute(async () => {
                        await this.apiClient.patch(
                            `/v2/adAccounts/${this.accountId}/campaigns/${campaignId}`,
                            linkedInCampaign
                        );
                    });
                },
                { platform: PlatformType.LINKEDIN, maxRetries: this.maxRetries }
            );
        } catch (error) {
            throw await handleApiError(error as Error, PlatformType.LINKEDIN);
        }
    }

    /**
     * Retrieves campaign details with error handling
     */
    async getCampaign(campaignId: string): Promise<ICampaign> {
        try {
            const response = await retryRequest(
                async () => {
                    return await this.circuitBreaker.execute(async () => {
                        const result = await this.apiClient.get(
                            `/v2/adAccounts/${this.accountId}/campaigns/${campaignId}`
                        );
                        return result.data;
                    });
                },
                { platform: PlatformType.LINKEDIN, maxRetries: this.maxRetries }
            );

            return this.transformResponseToCampaign(response);
        } catch (error) {
            throw await handleApiError(error as Error, PlatformType.LINKEDIN);
        }
    }

    /**
     * Deletes a LinkedIn campaign with validation
     */
    async deleteCampaign(campaignId: string): Promise<void> {
        try {
            await retryRequest(
                async () => {
                    return await this.circuitBreaker.execute(async () => {
                        await this.apiClient.delete(
                            `/v2/adAccounts/${this.accountId}/campaigns/${campaignId}`
                        );
                    });
                },
                { platform: PlatformType.LINKEDIN, maxRetries: this.maxRetries }
            );
        } catch (error) {
            throw await handleApiError(error as Error, PlatformType.LINKEDIN);
        }
    }

    /**
     * Pauses an active LinkedIn campaign
     */
    async pauseCampaign(campaignId: string): Promise<void> {
        try {
            await this.updateCampaign(campaignId, { status: CampaignStatus.PAUSED });
        } catch (error) {
            throw await handleApiError(error as Error, PlatformType.LINKEDIN);
        }
    }

    /**
     * Creates associated ad groups for a campaign
     */
    private async createAdGroups(campaignId: string, adGroups: IAdGroup[]): Promise<void> {
        try {
            await Promise.all(
                adGroups.map(async (adGroup) => {
                    const linkedInAdGroup = this.transformAdGroupData(adGroup, campaignId);
                    await retryRequest(
                        async () => {
                            return await this.circuitBreaker.execute(async () => {
                                await this.apiClient.post(
                                    `/v2/adAccounts/${this.accountId}/adGroups`,
                                    linkedInAdGroup
                                );
                            });
                        },
                        { platform: PlatformType.LINKEDIN, maxRetries: this.maxRetries }
                    );
                })
            );
        } catch (error) {
            throw await handleApiError(error as Error, PlatformType.LINKEDIN);
        }
    }

    /**
     * Transforms campaign data to LinkedIn API format
     */
    private transformCampaignData(campaign: Partial<ICampaign>, isUpdate: boolean = false): any {
        return {
            name: campaign.name,
            status: campaign.status,
            objectiveType: campaign.platformConfig?.linkedin?.objectiveType,
            campaignType: campaign.platformConfig?.linkedin?.campaignType,
            audienceExpansionEnabled: campaign.platformConfig?.linkedin?.audienceExpansion,
            enabledNetworks: campaign.platformConfig?.linkedin?.enabledNetworks,
            dailyBudget: {
                amount: campaign.budget?.amount,
                currencyCode: campaign.budget?.currency
            },
            startDate: campaign.budget?.startDate?.toISOString().split('T')[0],
            endDate: campaign.budget?.endDate?.toISOString().split('T')[0],
            targetingCriteria: this.transformTargetingData(campaign.targeting),
            // Additional fields omitted for brevity
        };
    }

    /**
     * Transforms ad group data to LinkedIn API format
     */
    private transformAdGroupData(adGroup: IAdGroup, campaignId: string): any {
        return {
            name: adGroup.name,
            campaignId: campaignId,
            status: adGroup.status,
            bidAmount: adGroup.bidAmount,
            bidStrategy: adGroup.bidStrategy,
            targeting: this.transformTargetingData(adGroup.targeting),
            // Additional fields omitted for brevity
        };
    }

    /**
     * Transforms targeting data to LinkedIn API format
     */
    private transformTargetingData(targeting: any): any {
        if (!targeting) return {};
        
        return {
            locations: targeting.locations?.map((location: any) => ({
                included: [location.id]
            })),
            industries: {
                included: targeting.industries
            },
            companySize: {
                included: targeting.companySize
            },
            jobTitles: {
                included: targeting.jobTitles
            },
            // Additional targeting criteria omitted for brevity
        };
    }

    /**
     * Transforms LinkedIn API response to campaign format
     */
    private transformResponseToCampaign(response: any): ICampaign {
        return {
            id: response.id,
            name: response.name,
            status: response.status,
            platform: PlatformType.LINKEDIN,
            budget: {
                amount: response.dailyBudget.amount,
                currency: response.dailyBudget.currencyCode,
                period: response.runSchedule.start,
                startDate: new Date(response.runSchedule.start),
                endDate: response.runSchedule.end ? new Date(response.runSchedule.end) : undefined
            },
            // Additional transformation logic omitted for brevity
        } as ICampaign;
    }
}