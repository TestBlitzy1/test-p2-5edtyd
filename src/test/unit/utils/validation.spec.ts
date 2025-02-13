import { describe, it, expect } from 'jest';
import { 
    validateEmail, 
    validatePassword, 
    validateCampaignBudget, 
    validateCampaignTargeting 
} from '../../../backend/shared/utils/validation';
import { TEST_USER } from '../../utils/test.constants';
import { 
    PlatformType, 
    BudgetPeriod, 
    CompanySizeRange 
} from '../../../backend/shared/types/campaign.types';

describe('Email Validation', () => {
    it('should validate correct business email format', () => {
        expect(validateEmail('user@company.com')).toBe(true);
        expect(validateEmail('first.last@enterprise.co.uk')).toBe(true);
        expect(validateEmail('user+dept@organization.net')).toBe(true);
    });

    it('should reject invalid email formats', () => {
        expect(validateEmail('invalid.email')).toBe(false);
        expect(validateEmail('@nodomain.com')).toBe(false);
        expect(validateEmail('spaces in@email.com')).toBe(false);
        expect(validateEmail('emoji😊@domain.com')).toBe(false);
    });

    it('should handle empty and null cases', () => {
        expect(validateEmail('')).toBe(false);
        expect(validateEmail(null as any)).toBe(false);
        expect(validateEmail(undefined as any)).toBe(false);
    });

    it('should flag disposable email domains', () => {
        expect(validateEmail('user@tempmail.com')).toBe(false);
        expect(validateEmail('test@disposable.com')).toBe(false);
        expect(validateEmail('user@fakeemail.net')).toBe(false);
    });

    it('should validate against test user email', () => {
        expect(validateEmail(TEST_USER.email)).toBe(true);
    });
});

describe('Password Validation', () => {
    it('should validate strong passwords', () => {
        expect(validatePassword('StrongP@ss123')).toBe(true);
        expect(validatePassword('C0mplex!tyR3quired')).toBe(true);
        expect(validatePassword('P@ssw0rd$WithSpec!als')).toBe(true);
    });

    it('should reject weak passwords', () => {
        expect(validatePassword('password123')).toBe(false);
        expect(validatePassword('qwerty')).toBe(false);
        expect(validatePassword('123456789')).toBe(false);
        expect(validatePassword('abcdefgh')).toBe(false);
    });

    it('should enforce minimum requirements', () => {
        // Missing uppercase
        expect(validatePassword('password@123')).toBe(false);
        // Missing lowercase
        expect(validatePassword('PASSWORD@123')).toBe(false);
        // Missing number
        expect(validatePassword('Password@abc')).toBe(false);
        // Missing special character
        expect(validatePassword('Password123')).toBe(false);
    });

    it('should reject passwords with repeated patterns', () => {
        expect(validatePassword('AAA@password123')).toBe(false);
        expect(validatePassword('Password111!')).toBe(false);
    });

    it('should handle empty and null cases', () => {
        expect(validatePassword('')).toBe(false);
        expect(validatePassword(null as any)).toBe(false);
        expect(validatePassword(undefined as any)).toBe(false);
    });
});

describe('Campaign Budget Validation', () => {
    const validLinkedInBudget = {
        amount: 50,
        currency: 'USD',
        period: BudgetPeriod.DAILY,
        startDate: new Date(Date.now() + 86400000), // Tomorrow
        endDate: new Date(Date.now() + 2592000000) // 30 days from now
    };

    it('should validate correct LinkedIn budget configuration', () => {
        const result = validateCampaignBudget(validLinkedInBudget, PlatformType.LINKEDIN);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    it('should validate correct Google Ads budget configuration', () => {
        const result = validateCampaignBudget({
            ...validLinkedInBudget,
            amount: 20
        }, PlatformType.GOOGLE);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    it('should reject budgets below platform minimums', () => {
        const result = validateCampaignBudget({
            ...validLinkedInBudget,
            amount: 5
        }, PlatformType.LINKEDIN);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Minimum budget for DAILY is 10 USD');
    });

    it('should validate supported currencies', () => {
        const result = validateCampaignBudget({
            ...validLinkedInBudget,
            currency: 'XYZ'
        }, PlatformType.LINKEDIN);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Currency XYZ not supported for LINKEDIN');
    });

    it('should reject past start dates', () => {
        const result = validateCampaignBudget({
            ...validLinkedInBudget,
            startDate: new Date(Date.now() - 86400000)
        }, PlatformType.LINKEDIN);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Start date cannot be in the past');
    });
});

describe('Campaign Targeting Validation', () => {
    const validLinkedInTargeting = {
        locations: [{
            id: 'us-1',
            country: 'United States',
            region: 'California'
        }],
        industries: ['Technology'],
        companySize: [CompanySizeRange.MEDIUM, CompanySizeRange.LARGE],
        jobTitles: ['Marketing Manager'],
        interests: ['Digital Marketing'],
        platformSpecific: {
            linkedin: {
                skills: ['Digital Marketing', 'Social Media'],
                groups: ['Marketing Professionals'],
                schools: ['Stanford University']
            }
        }
    };

    it('should validate correct LinkedIn targeting configuration', () => {
        const result = validateCampaignTargeting(validLinkedInTargeting, PlatformType.LINKEDIN);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    it('should validate correct Google Ads targeting configuration', () => {
        const result = validateCampaignTargeting({
            ...validLinkedInTargeting,
            platformSpecific: {
                google: {
                    keywords: ['digital marketing'],
                    topics: ['Marketing'],
                    placements: ['example.com']
                }
            }
        }, PlatformType.GOOGLE);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    it('should enforce location requirements', () => {
        const result = validateCampaignTargeting({
            ...validLinkedInTargeting,
            locations: []
        }, PlatformType.LINKEDIN);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('At least one location must be specified');
    });

    it('should validate company size requirements for LinkedIn', () => {
        const result = validateCampaignTargeting({
            ...validLinkedInTargeting,
            companySize: []
        }, PlatformType.LINKEDIN);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('At least one company size range must be specified');
    });

    it('should validate platform-specific targeting limits', () => {
        const result = validateCampaignTargeting({
            ...validLinkedInTargeting,
            platformSpecific: {
                linkedin: {
                    skills: Array(51).fill('Skill'), // Exceeds 50 skills limit
                    groups: ['Marketing Professionals'],
                    schools: ['Stanford University']
                }
            }
        }, PlatformType.LINKEDIN);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Maximum 50 skills allowed for LinkedIn targeting');
    });
});