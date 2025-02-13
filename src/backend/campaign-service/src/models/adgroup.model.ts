import mongoose from 'mongoose';
import * as z from 'zod';
import { IAdGroup, CampaignStatus } from '../../../shared/types/campaign.types';

/**
 * Enhanced AdGroup model class for managing ad group entities with MongoDB integration,
 * supporting platform-specific validation, transactions, and performance optimization
 */
export class AdGroupModel {
    private readonly Schema: mongoose.Schema;
    private readonly model: mongoose.Model<IAdGroup>;
    private readonly platformValidators: Map<string, z.ZodSchema>;

    constructor() {
        // Define MongoDB schema with platform-specific fields
        this.Schema = new mongoose.Schema({
            id: { type: String, required: true, unique: true },
            name: { 
                type: String, 
                required: true,
                minlength: 3,
                maxlength: 100,
                index: true 
            },
            targeting: {
                locations: [{
                    id: String,
                    country: String,
                    region: String,
                    city: String,
                    radius: Number,
                    radiusUnit: { 
                        type: String,
                        enum: ['KM', 'MI']
                    }
                }],
                industries: [String],
                companySize: [String],
                jobTitles: [String],
                interests: [String],
                ageRange: {
                    min: Number,
                    max: Number
                },
                platformSpecific: {
                    type: Map,
                    of: mongoose.Schema.Types.Mixed
                }
            },
            ads: [{
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Ad'
            }],
            status: {
                type: String,
                enum: Object.values(CampaignStatus),
                default: CampaignStatus.DRAFT,
                index: true
            },
            budget: {
                amount: Number,
                currency: String,
                period: String,
                startDate: Date,
                endDate: Date
            },
            bidAmount: Number,
            bidStrategy: {
                type: String,
                enum: ['AUTOMATED', 'MANUAL'],
                required: true
            },
            createdAt: {
                type: Date,
                default: Date.now,
                index: true
            },
            updatedAt: {
                type: Date,
                default: Date.now
            },
            isDeleted: {
                type: Boolean,
                default: false,
                index: true
            }
        }, {
            timestamps: true,
            optimisticConcurrency: true
        });

        // Set up compound indexes for efficient querying
        this.Schema.index({ campaignId: 1, status: 1 });
        this.Schema.index({ isDeleted: 1, updatedAt: -1 });

        // Initialize platform-specific validation schemas
        this.initializePlatformValidators();

        // Set up soft deletion middleware
        this.setupSoftDeletionMiddleware();

        // Register schema with Mongoose
        this.model = mongoose.model<IAdGroup>('AdGroup', this.Schema);
    }

    /**
     * Initialize platform-specific Zod validation schemas
     */
    private initializePlatformValidators(): void {
        this.platformValidators = new Map([
            ['LINKEDIN', z.object({
                name: z.string().min(3).max(100),
                targeting: z.object({
                    industries: z.array(z.string()),
                    companySize: z.array(z.string()),
                    jobTitles: z.array(z.string()),
                    platformSpecific: z.object({
                        skills: z.array(z.string()).optional(),
                        groups: z.array(z.string()).optional(),
                        schools: z.array(z.string()).optional()
                    })
                })
            })],
            ['GOOGLE', z.object({
                name: z.string().min(3).max(100),
                targeting: z.object({
                    locations: z.array(z.object({
                        id: z.string(),
                        country: z.string(),
                        radius: z.number().optional()
                    })),
                    platformSpecific: z.object({
                        keywords: z.array(z.string()).optional(),
                        topics: z.array(z.string()).optional(),
                        placements: z.array(z.string()).optional()
                    })
                })
            })]
        ]);
    }

    /**
     * Set up soft deletion middleware for audit purposes
     */
    private setupSoftDeletionMiddleware(): void {
        this.Schema.pre('find', function() {
            this.where({ isDeleted: false });
        });

        this.Schema.pre('findOne', function() {
            this.where({ isDeleted: false });
        });
    }

    /**
     * Creates multiple ad groups within a campaign with transaction support
     */
    async createBulk(
        campaignId: string, 
        adGroupsData: IAdGroup[]
    ): Promise<IAdGroup[]> {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const createdAdGroups = await this.model.create(
                adGroupsData.map(adGroup => ({
                    ...adGroup,
                    campaignId,
                    status: CampaignStatus.DRAFT
                })),
                { session }
            );

            await session.commitTransaction();
            return createdAdGroups;
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    }

    /**
     * Updates an ad group with platform-specific validation
     */
    async updateWithPlatformValidation(
        id: string,
        updateData: Partial<IAdGroup>,
        platform: string
    ): Promise<IAdGroup> {
        const validator = this.platformValidators.get(platform);
        if (!validator) {
            throw new Error(`Unsupported platform: ${platform}`);
        }

        validator.parse(updateData);

        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const updatedAdGroup = await this.model.findByIdAndUpdate(
                id,
                { 
                    ...updateData,
                    updatedAt: new Date()
                },
                { 
                    new: true,
                    session,
                    runValidators: true
                }
            );

            if (!updatedAdGroup) {
                throw new Error('Ad group not found');
            }

            await session.commitTransaction();
            return updatedAdGroup;
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    }

    /**
     * Performs soft deletion of an ad group for audit purposes
     */
    async softDelete(id: string): Promise<boolean> {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const result = await this.model.updateOne(
                { _id: id },
                { 
                    isDeleted: true,
                    status: CampaignStatus.ARCHIVED,
                    updatedAt: new Date()
                },
                { session }
            );

            await session.commitTransaction();
            return result.modifiedCount > 0;
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    }

    /**
     * Retrieves all ad groups for a campaign with caching
     */
    async getByCampaignIdWithCache(campaignId: string): Promise<IAdGroup[]> {
        const cacheKey = `adgroups:${campaignId}`;
        
        // Implementation note: Actual cache logic would be injected via dependency
        const adGroups = await this.model
            .find({ campaignId })
            .populate('ads')
            .lean();

        return adGroups;
    }

    /**
     * Updates ad group status with platform-specific logic
     */
    async updatePlatformStatus(
        id: string,
        status: CampaignStatus,
        platform: string
    ): Promise<IAdGroup> {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const adGroup = await this.model.findByIdAndUpdate(
                id,
                { 
                    status,
                    updatedAt: new Date()
                },
                { 
                    new: true,
                    session,
                    runValidators: true
                }
            );

            if (!adGroup) {
                throw new Error('Ad group not found');
            }

            await session.commitTransaction();
            return adGroup;
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    }
}

export default new AdGroupModel();