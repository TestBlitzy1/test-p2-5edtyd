import { z } from 'zod'; // v3.22.0
import { isEmail } from 'validator'; // v13.11.0
import { 
  ICampaign, 
  PlatformType,
  BudgetPeriod,
  CampaignStatus,
  CampaignObjective 
} from '../types/campaign';
import { LoginCredentials } from '../types/auth';

// Global constants for validation rules
const MIN_PASSWORD_LENGTH = 8;
const PLATFORM_MIN_BUDGETS: Record<PlatformType, number> = {
  [PlatformType.LINKEDIN]: 10,
  [PlatformType.GOOGLE]: 5
};
const MAX_TARGETING_LOCATIONS = 30;
const PASSWORD_COMPLEXITY_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP', 'AUD', 'CAD'];

// Validation error and warning interfaces
interface ValidationError {
  code: string;
  message: string;
  field?: string;
}

interface ValidationWarning {
  code: string;
  message: string;
  recommendation?: string;
}

interface BudgetRecommendation {
  type: 'INCREASE' | 'DECREASE' | 'REALLOCATION';
  message: string;
  suggestedValue?: number;
}

interface TargetingReachEstimate {
  minReach: number;
  maxReach: number;
  confidence: number;
}

// Zod schemas for validation
const budgetSchema = z.object({
  amount: z.number().positive(),
  currency: z.enum(SUPPORTED_CURRENCIES),
  period: z.nativeEnum(BudgetPeriod)
});

const targetingSchema = z.object({
  locations: z.array(z.string()).max(MAX_TARGETING_LOCATIONS),
  industries: z.array(z.string()).min(1),
  companySize: z.array(z.string()).min(1),
  jobTitles: z.array(z.string())
});

const campaignSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string().min(3).max(100),
  platform: z.nativeEnum(PlatformType),
  objective: z.nativeEnum(CampaignObjective),
  status: z.nativeEnum(CampaignStatus),
  budget: budgetSchema,
  targeting: targetingSchema,
  adGroups: z.array(z.any()).min(1),
  performanceTargets: z.array(z.any()),
  createdAt: z.date(),
  updatedAt: z.date()
});

/**
 * Validates a campaign configuration against platform-specific requirements
 * @param campaign - Campaign configuration to validate
 * @returns Validation results with errors and warnings
 */
export async function validateCampaign(
  campaign: ICampaign
): Promise<{ isValid: boolean; errors: ValidationError[]; warnings: ValidationWarning[] }> {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  try {
    // Basic schema validation
    campaignSchema.parse(campaign);

    // Platform-specific budget validation
    const budgetValidation = validateBudget(campaign.budget, campaign.platform);
    if (!budgetValidation.isValid) {
      errors.push(...budgetValidation.errors);
    }

    // Targeting validation
    const targetingValidation = await validateTargeting(campaign.targeting, campaign.platform);
    if (!targetingValidation.isValid) {
      errors.push(...targetingValidation.errors);
    }

    // Ad group validation
    if (campaign.adGroups.length === 0) {
      errors.push({
        code: 'INVALID_AD_GROUPS',
        message: 'Campaign must have at least one ad group'
      });
    }

    // Performance targets validation
    if (campaign.performanceTargets.length === 0) {
      warnings.push({
        code: 'NO_PERFORMANCE_TARGETS',
        message: 'Campaign has no performance targets defined',
        recommendation: 'Consider adding performance targets for better campaign tracking'
      });
    }

  } catch (error) {
    if (error instanceof z.ZodError) {
      errors.push(...error.errors.map(err => ({
        code: 'SCHEMA_VALIDATION_ERROR',
        message: err.message,
        field: err.path.join('.')
      })));
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validates login credentials with enhanced security checks
 * @param credentials - Login credentials to validate
 * @returns Validation results with MFA requirement check
 */
export async function validateLoginCredentials(
  credentials: LoginCredentials
): Promise<{ isValid: boolean; errors: ValidationError[]; requiresMFA: boolean }> {
  const errors: ValidationError[] = [];
  let requiresMFA = false;

  // Email validation
  if (!isEmail(credentials.email)) {
    errors.push({
      code: 'INVALID_EMAIL',
      message: 'Invalid email format',
      field: 'email'
    });
  }

  // Password validation
  if (!PASSWORD_COMPLEXITY_REGEX.test(credentials.password)) {
    errors.push({
      code: 'INVALID_PASSWORD',
      message: 'Password must contain at least 8 characters, one uppercase letter, one lowercase letter, one number and one special character',
      field: 'password'
    });
  }

  // Additional security checks can trigger MFA
  requiresMFA = credentials.email.includes('admin') || credentials.email.includes('finance');

  return {
    isValid: errors.length === 0,
    errors,
    requiresMFA
  };
}

/**
 * Validates campaign budget against platform-specific requirements
 * @param budget - Budget configuration to validate
 * @param platform - Target advertising platform
 * @returns Budget validation results with recommendations
 */
export function validateBudget(
  budget: ICampaign['budget'],
  platform: PlatformType
): { isValid: boolean; errors: ValidationError[]; recommendations: BudgetRecommendation[] } {
  const errors: ValidationError[] = [];
  const recommendations: BudgetRecommendation[] = [];

  // Check minimum budget requirements
  if (budget.amount < PLATFORM_MIN_BUDGETS[platform]) {
    errors.push({
      code: 'INSUFFICIENT_BUDGET',
      message: `Minimum budget for ${platform} is ${PLATFORM_MIN_BUDGETS[platform]} ${budget.currency}`,
      field: 'budget.amount'
    });
  }

  // Currency validation
  if (!SUPPORTED_CURRENCIES.includes(budget.currency)) {
    errors.push({
      code: 'UNSUPPORTED_CURRENCY',
      message: `Currency ${budget.currency} is not supported. Supported currencies: ${SUPPORTED_CURRENCIES.join(', ')}`,
      field: 'budget.currency'
    });
  }

  // Budget optimization recommendations
  if (budget.amount < PLATFORM_MIN_BUDGETS[platform] * 2) {
    recommendations.push({
      type: 'INCREASE',
      message: 'Consider increasing budget for better campaign performance',
      suggestedValue: PLATFORM_MIN_BUDGETS[platform] * 2
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    recommendations
  };
}

/**
 * Validates targeting configuration against platform capabilities
 * @param targeting - Targeting configuration to validate
 * @param platform - Target advertising platform
 * @returns Targeting validation results with reach estimates
 */
export async function validateTargeting(
  targeting: ICampaign['targeting'],
  platform: PlatformType
): Promise<{ isValid: boolean; errors: ValidationError[]; reachEstimate: TargetingReachEstimate }> {
  const errors: ValidationError[] = [];
  const reachEstimate: TargetingReachEstimate = {
    minReach: 0,
    maxReach: 0,
    confidence: 0
  };

  // Location targeting validation
  if (targeting.locations.length > MAX_TARGETING_LOCATIONS) {
    errors.push({
      code: 'EXCESSIVE_LOCATIONS',
      message: `Maximum number of targeting locations is ${MAX_TARGETING_LOCATIONS}`,
      field: 'targeting.locations'
    });
  }

  // Industry targeting validation
  if (targeting.industries.length === 0) {
    errors.push({
      code: 'NO_INDUSTRIES',
      message: 'At least one industry must be targeted',
      field: 'targeting.industries'
    });
  }

  // Company size targeting validation
  if (targeting.companySize.length === 0) {
    errors.push({
      code: 'NO_COMPANY_SIZE',
      message: 'At least one company size must be targeted',
      field: 'targeting.companySize'
    });
  }

  // Platform-specific targeting validation
  if (platform === PlatformType.LINKEDIN && targeting.jobTitles.length === 0) {
    errors.push({
      code: 'NO_JOB_TITLES',
      message: 'LinkedIn campaigns require job title targeting',
      field: 'targeting.jobTitles'
    });
  }

  // Calculate reach estimates based on targeting parameters
  if (errors.length === 0) {
    reachEstimate.minReach = 10000; // Placeholder values
    reachEstimate.maxReach = 50000;
    reachEstimate.confidence = 0.85;
  }

  return {
    isValid: errors.length === 0,
    errors,
    reachEstimate
  };
}