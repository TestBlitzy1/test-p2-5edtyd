import mongoose from 'mongoose'; // ^7.5.0
import { z } from 'zod'; // ^3.22.0
import { IAd, PlatformType } from '../../../shared/types/campaign.types';
import { validatePlatformRequirements } from '../utils/validation.utils';

// Platform-specific creative constraints
const CREATIVE_CONSTRAINTS = {
    LINKEDIN: {
        HEADLINE_MAX_LENGTH: 200,
        DESCRIPTION_MAX_LENGTH: 600,
        IMAGE_DIMENSIONS: {
            MIN_WIDTH: 400,
            MIN_HEIGHT: 400,
            MAX_SIZE_MB: 5
        }
    },
    GOOGLE: {
        HEADLINE_MAX_LENGTH: 30,
        DESCRIPTION_MAX_LENGTH: 90,
        IMAGE_DIMENSIONS: {
            MIN_WIDTH: 600,
            MIN_HEIGHT: 314,
            MAX_SIZE_MB: 10
        }
    }
};

// Zod schema for creative validation
const creativeValidationSchema = z.object({
    name: z.string().min(1).max(255),
    type: z.enum(['TEXT', 'DISPLAY', 'VIDEO']),
    headline: z.string().min(1),
    description: z.string().min(1),
    assets: z.array(z.object({
        type: z.enum(['IMAGE', 'VIDEO', 'CAROUSEL']),
        url: z.string().url(),
        title: z.string().optional(),
        description: z.string().optional(),
        callToAction: z.string().optional()
    })).min(1),
    destinationUrl: z.string().url(),
    status: z.enum(['ACTIVE', 'PAUSED', 'ARCHIVED']),
    aiOptimized: z.boolean().default(false),
    performanceScore: z.number().min(0).max(100).optional(),
    variants: z.array(z.string()).optional()
});

// Mongoose schema for creative content
const creativeSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 255
    },
    type: {
        type: String,
        required: true,
        enum: ['TEXT', 'DISPLAY', 'VIDEO']
    },
    headline: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true,
        trim: true
    },
    assets: [{
        type: {
            type: String,
            required: true,
            enum: ['IMAGE', 'VIDEO', 'CAROUSEL']
        },
        url: {
            type: String,
            required: true
        },
        title: String,
        description: String,
        callToAction: String,
        dimensions: {
            width: Number,
            height: Number,
            fileSize: Number
        }
    }],
    destinationUrl: {
        type: String,
        required: true
    },
    status: {
        type: String,
        required: true,
        enum: ['ACTIVE', 'PAUSED', 'ARCHIVED'],
        default: 'ACTIVE'
    },
    aiOptimized: {
        type: Boolean,
        default: false
    },
    performanceScore: {
        type: Number,
        min: 0,
        max: 100
    },
    variants: [String],
    metadata: {
        platform: {
            type: String,
            required: true,
            enum: Object.values(PlatformType)
        },
        optimizationHistory: [{
            timestamp: Date,
            changes: [String],
            performanceImpact: Number
        }]
    }
}, {
    timestamps: true
});

// Indexes for performance optimization
creativeSchema.index({ status: 1, platform: 1 });
creativeSchema.index({ performanceScore: -1 });
creativeSchema.index({ aiOptimized: 1 });

export class CreativeModel {
    private model: mongoose.Model<any>;
    private validationSchema: z.ZodSchema;

    constructor() {
        this.model = mongoose.model('Creative', creativeSchema);
        this.validationSchema = creativeValidationSchema;
    }

    /**
     * Validates creative content against platform-specific requirements
     * @param creative Creative content to validate
     * @param platform Target advertising platform
     * @returns Validation result with detailed error messages
     */
    async validateCreative(creative: IAd, platform: PlatformType): Promise<ValidationResult> {
        try {
            // Basic schema validation
            this.validationSchema.parse(creative);

            const errors: string[] = [];
            const constraints = platform === PlatformType.LINKEDIN 
                ? CREATIVE_CONSTRAINTS.LINKEDIN 
                : CREATIVE_CONSTRAINTS.GOOGLE;

            // Validate headline length
            if (creative.headline.length > constraints.HEADLINE_MAX_LENGTH) {
                errors.push(`Headline exceeds maximum length of ${constraints.HEADLINE_MAX_LENGTH} characters`);
            }

            // Validate description length
            if (creative.description.length > constraints.DESCRIPTION_MAX_LENGTH) {
                errors.push(`Description exceeds maximum length of ${constraints.DESCRIPTION_MAX_LENGTH} characters`);
            }

            // Validate assets
            for (const asset of creative.assets) {
                if (asset.type === 'IMAGE') {
                    const dimensions = await this.validateImageDimensions(asset.url);
                    if (dimensions) {
                        if (dimensions.width < constraints.IMAGE_DIMENSIONS.MIN_WIDTH ||
                            dimensions.height < constraints.IMAGE_DIMENSIONS.MIN_HEIGHT) {
                            errors.push(`Image dimensions must be at least ${constraints.IMAGE_DIMENSIONS.MIN_WIDTH}x${constraints.IMAGE_DIMENSIONS.MIN_HEIGHT}`);
                        }
                        if (dimensions.fileSize > constraints.IMAGE_DIMENSIONS.MAX_SIZE_MB * 1024 * 1024) {
                            errors.push(`Image file size must not exceed ${constraints.IMAGE_DIMENSIONS.MAX_SIZE_MB}MB`);
                        }
                    }
                }
            }

            // Platform-specific validation
            const platformValidation = await validatePlatformRequirements(creative, platform);
            if (!platformValidation) {
                errors.push('Failed platform-specific requirements validation');
            }

            return {
                isValid: errors.length === 0,
                errors
            };
        } catch (error) {
            return {
                isValid: false,
                errors: [(error as Error).message]
            };
        }
    }

    /**
     * Generates AI-optimized variants of creative content
     * @param baseCreative Base creative content
     * @param platform Target advertising platform
     * @param options Variant generation options
     * @returns Array of optimized creative variants
     */
    async generateCreativeVariants(
        baseCreative: IAd,
        platform: PlatformType,
        options: VariantOptions
    ): Promise<IAd[]> {
        const variants: IAd[] = [];
        const constraints = platform === PlatformType.LINKEDIN 
            ? CREATIVE_CONSTRAINTS.LINKEDIN 
            : CREATIVE_CONSTRAINTS.GOOGLE;

        try {
            // Generate headline variations
            const headlineVariants = await this.generateHeadlineVariants(
                baseCreative.headline,
                constraints.HEADLINE_MAX_LENGTH,
                options.numVariants
            );

            // Generate description variations
            const descriptionVariants = await this.generateDescriptionVariants(
                baseCreative.description,
                constraints.DESCRIPTION_MAX_LENGTH,
                options.numVariants
            );

            // Create combinations of variants
            for (let i = 0; i < options.numVariants; i++) {
                const variant: IAd = {
                    ...baseCreative,
                    id: `${baseCreative.id}_variant_${i + 1}`,
                    headline: headlineVariants[i] || baseCreative.headline,
                    description: descriptionVariants[i] || baseCreative.description,
                    status: 'ACTIVE',
                    createdAt: new Date(),
                    updatedAt: new Date()
                };

                // Validate variant
                const validation = await this.validateCreative(variant, platform);
                if (validation.isValid) {
                    variants.push(variant);
                }
            }

            return variants;
        } catch (error) {
            console.error('Error generating creative variants:', error);
            return [baseCreative];
        }
    }

    // Private helper methods
    private async validateImageDimensions(imageUrl: string): Promise<ImageDimensions | null> {
        // Implementation for image dimension validation
        // This would typically involve fetching and analyzing the image
        return null;
    }

    private async generateHeadlineVariants(
        baseHeadline: string,
        maxLength: number,
        count: number
    ): Promise<string[]> {
        // Implementation for AI-powered headline generation
        return [baseHeadline];
    }

    private async generateDescriptionVariants(
        baseDescription: string,
        maxLength: number,
        count: number
    ): Promise<string[]> {
        // Implementation for AI-powered description generation
        return [baseDescription];
    }
}

// Type definitions
interface ValidationResult {
    isValid: boolean;
    errors: string[];
}

interface ImageDimensions {
    width: number;
    height: number;
    fileSize: number;
}

interface VariantOptions {
    numVariants: number;
    optimizationGoals?: string[];
    preserveKeywords?: boolean;
}

export default new CreativeModel();