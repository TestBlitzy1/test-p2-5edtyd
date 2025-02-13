import { z } from 'zod';
import validator from 'validator';
import isoCurrency from 'iso-currency';
import { IUser } from '../types/auth.types';
import { 
    ICampaign, 
    IBudget, 
    ITargeting,
    PlatformType,
    CompanySizeRange,
    BudgetPeriod
} from '../types/campaign.types';

// Platform-specific constants
const PLATFORM_CONSTRAINTS = {
    LINKEDIN: {
        MIN_BUDGET_DAILY: 10,
        MIN_BUDGET_LIFETIME: 100,
        MAX_LOCATIONS: 100,
        MIN_COMPANY_SIZES: 1,
        MAX_JOB_TITLES: 100,
        MIN_AUDIENCE_SIZE: 1000,
        SUPPORTED_CURRENCIES: ['USD', 'EUR', 'GBP', 'AUD', 'CAD']
    },
    GOOGLE: {
        MIN_BUDGET_DAILY: 5,
        MIN_BUDGET_LIFETIME: 50,
        MAX_LOCATIONS: 250,
        MAX_KEYWORDS: 10000,
        MIN_AUDIENCE_SIZE: 100,
        SUPPORTED_CURRENCIES: ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD']
    }
};

// Common validation schemas
const emailSchema = z.string().email().min(5).max(255);
const passwordSchema = z.string().min(8).max(100).regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/
);

/**
 * Validates email format and domain with enhanced security checks
 * @param email - Email address to validate
 * @returns boolean indicating if email is valid
 */
export const validateEmail = (email: string): boolean => {
    try {
        // Basic format validation
        emailSchema.parse(email);
        
        // Enhanced validation using validator
        if (!validator.isEmail(email, { 
            allow_utf8_local_part: false,
            require_tld: true
        })) {
            return false;
        }

        // Check for disposable email domains
        if (validator.matches(email, /(temp|fake|disposable)/i)) {
            return false;
        }

        // Verify business email (optional)
        const domain = email.split('@')[1];
        if (validator.matches(domain, /(gmail|yahoo|hotmail|outlook)/i)) {
            // Consider logging or flagging personal email domains
        }

        return true;
    } catch {
        return false;
    }
};

/**
 * Validates password strength and requirements with enhanced security
 * @param password - Password to validate
 * @returns boolean indicating if password meets requirements
 */
export const validatePassword = (password: string): boolean => {
    try {
        // Schema validation
        passwordSchema.parse(password);

        // Additional security checks
        const hasWeakPatterns = /^(password|123456|qwerty)/i.test(password) ||
            /(.)\1{2,}/.test(password); // Repeated characters

        if (hasWeakPatterns) {
            return false;
        }

        // Calculate entropy score
        const entropyScore = calculatePasswordEntropy(password);
        return entropyScore >= 60; // Minimum required entropy

    } catch {
        return false;
    }
};

/**
 * Validates campaign budget constraints with platform-specific rules
 * @param budget - Budget configuration to validate
 * @param platform - Target advertising platform
 * @returns ValidationResult with detailed validation information
 */
export const validateCampaignBudget = (
    budget: IBudget,
    platform: PlatformType
): ValidationResult => {
    const errors: string[] = [];
    const constraints = PLATFORM_CONSTRAINTS[platform];

    // Validate currency
    if (!constraints.SUPPORTED_CURRENCIES.includes(budget.currency)) {
        errors.push(`Currency ${budget.currency} not supported for ${platform}`);
    }

    // Validate amount based on period
    const minAmount = budget.period === BudgetPeriod.DAILY 
        ? constraints.MIN_BUDGET_DAILY 
        : constraints.MIN_BUDGET_LIFETIME;

    if (budget.amount < minAmount) {
        errors.push(`Minimum budget for ${budget.period} is ${minAmount} ${budget.currency}`);
    }

    // Validate date range
    if (budget.startDate < new Date()) {
        errors.push('Start date cannot be in the past');
    }

    if (budget.endDate && budget.endDate <= budget.startDate) {
        errors.push('End date must be after start date');
    }

    // Platform-specific validations
    if (platform === PlatformType.LINKEDIN && budget.period === BudgetPeriod.MONTHLY) {
        errors.push('LinkedIn does not support monthly budgets');
    }

    return {
        isValid: errors.length === 0,
        errors
    };
};

/**
 * Validates campaign targeting parameters with platform-specific rules
 * @param targeting - Targeting configuration to validate
 * @param platform - Target advertising platform
 * @returns ValidationResult with detailed validation information
 */
export const validateCampaignTargeting = (
    targeting: ITargeting,
    platform: PlatformType
): ValidationResult => {
    const errors: string[] = [];
    const constraints = PLATFORM_CONSTRAINTS[platform];

    // Validate locations
    if (!targeting.locations.length) {
        errors.push('At least one location must be specified');
    } else if (targeting.locations.length > constraints.MAX_LOCATIONS) {
        errors.push(`Maximum ${constraints.MAX_LOCATIONS} locations allowed`);
    }

    // Validate company sizes
    if (platform === PlatformType.LINKEDIN) {
        if (!targeting.companySize.length) {
            errors.push('At least one company size range must be specified');
        }
        
        // Validate company size ranges
        targeting.companySize.forEach(size => {
            if (!Object.values(CompanySizeRange).includes(size)) {
                errors.push(`Invalid company size range: ${size}`);
            }
        });
    }

    // Platform-specific targeting validation
    if (platform === PlatformType.LINKEDIN) {
        validateLinkedInTargeting(targeting, errors);
    } else {
        validateGoogleTargeting(targeting, errors);
    }

    return {
        isValid: errors.length === 0,
        errors
    };
};

// Helper interfaces
interface ValidationResult {
    isValid: boolean;
    errors: string[];
}

// Private helper functions
const calculatePasswordEntropy = (password: string): number => {
    const charset = {
        numbers: /\d/.test(password),
        lowerCase: /[a-z]/.test(password),
        upperCase: /[A-Z]/.test(password),
        symbols: /[^A-Za-z0-9]/.test(password)
    };

    const poolSize = Object.values(charset).filter(Boolean).length * 26;
    return Math.log2(Math.pow(poolSize, password.length));
};

const validateLinkedInTargeting = (targeting: ITargeting, errors: string[]): void => {
    const { platformSpecific } = targeting;
    
    if (!platformSpecific.linkedin) {
        errors.push('LinkedIn-specific targeting parameters required');
        return;
    }

    const { skills, groups, schools } = platformSpecific.linkedin;

    if (skills && skills.length > 50) {
        errors.push('Maximum 50 skills allowed for LinkedIn targeting');
    }

    if (groups && groups.length > 100) {
        errors.push('Maximum 100 groups allowed for LinkedIn targeting');
    }

    if (schools && schools.length > 100) {
        errors.push('Maximum 100 schools allowed for LinkedIn targeting');
    }
};

const validateGoogleTargeting = (targeting: ITargeting, errors: string[]): void => {
    const { platformSpecific } = targeting;
    
    if (!platformSpecific.google) {
        errors.push('Google Ads-specific targeting parameters required');
        return;
    }

    const { keywords, topics, placements } = platformSpecific.google;

    if (keywords && keywords.length > PLATFORM_CONSTRAINTS.GOOGLE.MAX_KEYWORDS) {
        errors.push(`Maximum ${PLATFORM_CONSTRAINTS.GOOGLE.MAX_KEYWORDS} keywords allowed`);
    }

    if (topics && topics.length > 2000) {
        errors.push('Maximum 2000 topics allowed for Google Ads targeting');
    }

    if (placements && placements.length > 500) {
        errors.push('Maximum 500 placements allowed for Google Ads targeting');
    }
};