// External package imports
import { Schema, SchemaTypes } from 'mongoose';
import { Entity, Column, PrimaryGeneratedColumn, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm';

// Internal imports
import { 
    ICampaign, 
    PlatformType,
    CampaignObjective,
    CampaignStatus,
    BudgetPeriod,
    IBudget,
    ITargeting,
    CompanySizeRange
} from '../types/campaign.types';
import { MetricType } from '../types/analytics.types';

/**
 * Mongoose schema definition for campaign data with comprehensive validation
 */
@Schema({ timestamps: true, collection: 'campaigns' })
export class CampaignSchema {
    @Column()
    id: string;

    @Column({ required: true })
    userId: string;

    @Column({
        required: true,
        trim: true,
        minlength: 3,
        maxlength: 100,
        validate: {
            validator: (name: string) => /^[\w\s-]+$/i.test(name),
            message: 'Campaign name must contain only letters, numbers, spaces, and hyphens'
        }
    })
    name: string;

    @Column({
        required: true,
        enum: Object.values(PlatformType)
    })
    platform: PlatformType;

    @Column({
        required: true,
        enum: Object.values(CampaignObjective)
    })
    objective: CampaignObjective;

    @Column({
        required: true,
        enum: Object.values(CampaignStatus),
        default: CampaignStatus.DRAFT
    })
    status: CampaignStatus;

    @Column({
        required: true,
        type: SchemaTypes.Mixed,
        validate: {
            validator: validateBudget,
            message: 'Invalid budget configuration'
        }
    })
    budget: IBudget;

    @Column({
        required: true,
        type: SchemaTypes.Mixed,
        validate: {
            validator: validateTargeting,
            message: 'Invalid targeting configuration'
        }
    })
    targeting: ITargeting;

    @Column({
        type: [SchemaTypes.Mixed],
        default: [],
        validate: {
            validator: validateAdGroups,
            message: 'Invalid ad group configuration'
        }
    })
    adGroups: any[];

    @Column({
        type: [{
            metric: {
                type: String,
                enum: Object.values(MetricType),
                required: true
            },
            target: {
                type: Number,
                required: true,
                min: 0
            },
            timeframe: {
                type: Number,
                required: true,
                min: 1,
                max: 365
            },
            priority: {
                type: Number,
                required: true,
                min: 1,
                max: 5
            }
        }],
        default: []
    })
    performanceTargets: any[];

    @Column({
        type: SchemaTypes.Mixed,
        default: {
            enabled: false,
            optimizationGoals: [],
            autoOptimize: false,
            minBudgetAdjustment: -20,
            maxBudgetAdjustment: 20,
            optimizationFrequency: 24
        }
    })
    aiOptimization: {
        enabled: boolean;
        optimizationGoals: MetricType[];
        autoOptimize: boolean;
        minBudgetAdjustment: number;
        maxBudgetAdjustment: number;
        optimizationFrequency: number;
    };

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @Column({ type: SchemaTypes.Mixed })
    platformConfig: any;

    @Column({
        type: [{
            timestamp: Date,
            userId: String,
            action: String,
            details: SchemaTypes.Mixed
        }],
        default: []
    })
    changeHistory: any[];
}

/**
 * TypeORM entity for campaign data persistence
 */
@Entity('campaigns')
@Index(['userId', 'status'])
@Index(['platform', 'createdAt'])
export class CampaignEntity implements ICampaign {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    userId: string;

    @Column({ length: 100 })
    name: string;

    @Column({
        type: 'enum',
        enum: PlatformType
    })
    platform: PlatformType;

    @Column({
        type: 'enum',
        enum: CampaignObjective
    })
    objective: CampaignObjective;

    @Column({
        type: 'enum',
        enum: CampaignStatus,
        default: CampaignStatus.DRAFT
    })
    status: CampaignStatus;

    @Column('jsonb')
    budget: IBudget;

    @Column('jsonb')
    targeting: ITargeting;

    @Column('jsonb', { default: [] })
    adGroups: any[];

    @Column('jsonb', { default: [] })
    performanceTargets: any[];

    @Column('jsonb', {
        default: {
            enabled: false,
            optimizationGoals: [],
            autoOptimize: false,
            minBudgetAdjustment: -20,
            maxBudgetAdjustment: 20,
            optimizationFrequency: 24
        }
    })
    aiOptimization: any;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @Column('jsonb')
    platformConfig: any;

    @Column('jsonb', { default: [] })
    changeHistory: any[];
}

/**
 * Validates campaign budget configuration
 */
function validateBudget(budget: IBudget): boolean {
    if (!budget || typeof budget !== 'object') return false;

    // Validate amount
    if (typeof budget.amount !== 'number' || budget.amount <= 0) return false;

    // Validate currency (ISO 4217)
    if (!/^[A-Z]{3}$/.test(budget.currency)) return false;

    // Validate period
    if (!Object.values(BudgetPeriod).includes(budget.period)) return false;

    // Validate dates
    if (!(budget.startDate instanceof Date)) return false;
    if (budget.endDate && !(budget.endDate instanceof Date)) return false;
    if (budget.endDate && budget.endDate <= budget.startDate) return false;

    return true;
}

/**
 * Validates campaign targeting configuration
 */
function validateTargeting(targeting: ITargeting): boolean {
    if (!targeting || typeof targeting !== 'object') return false;

    // Validate locations
    if (!Array.isArray(targeting.locations) || targeting.locations.length === 0) return false;
    
    // Validate industries
    if (!Array.isArray(targeting.industries) || targeting.industries.length === 0) return false;

    // Validate company sizes
    if (!Array.isArray(targeting.companySize) || targeting.companySize.length === 0) {
        return false;
    }
    if (!targeting.companySize.every(size => Object.values(CompanySizeRange).includes(size))) {
        return false;
    }

    // Validate job titles
    if (!Array.isArray(targeting.jobTitles) || targeting.jobTitles.length === 0) return false;

    // Validate age range if provided
    if (targeting.ageRange) {
        const { min, max } = targeting.ageRange;
        if (typeof min !== 'number' || typeof max !== 'number') return false;
        if (min < 18 || max > 65 || min >= max) return false;
    }

    return true;
}

/**
 * Validates ad groups configuration
 */
function validateAdGroups(adGroups: any[]): boolean {
    if (!Array.isArray(adGroups)) return false;

    return adGroups.every(group => {
        if (!group.id || !group.name) return false;
        if (!group.targeting || !validateTargeting(group.targeting)) return false;
        if (!Array.isArray(group.ads)) return false;
        
        return group.ads.every(ad => {
            if (!ad.id || !ad.name || !ad.headline || !ad.description) return false;
            if (!Array.isArray(ad.assets)) return false;
            if (!ad.destinationUrl || !/^https?:\/\/.+/.test(ad.destinationUrl)) return false;
            return true;
        });
    });
}