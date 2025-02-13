import { hash, compare, genSalt } from 'bcryptjs'; // ^2.4.3

// Number of salt rounds for bcrypt hashing
const SALT_ROUNDS = 12;

/**
 * Asynchronously hashes a plain text password using bcrypt with a cryptographically secure salt
 * @param password Plain text password to hash
 * @returns Promise resolving to the securely hashed password string
 * @throws Error if password is empty/undefined or if hashing fails
 */
export async function hashPassword(password: string): Promise<string> {
    if (!password) {
        throw new Error('Password must not be empty');
    }

    try {
        const salt = await genSalt(SALT_ROUNDS);
        const hashedPassword = await hash(password, salt);
        return hashedPassword;
    } catch (error) {
        throw new Error('Failed to hash password: ' + (error as Error).message);
    }
}

/**
 * Asynchronously compares a plain text password with a hashed password using secure comparison
 * @param plainPassword Plain text password to compare
 * @param hashedPassword Hashed password to compare against
 * @returns Promise resolving to true if passwords match, false otherwise
 * @throws Error if either password is empty/undefined or if comparison fails
 */
export async function comparePasswords(plainPassword: string, hashedPassword: string): Promise<boolean> {
    if (!plainPassword || !hashedPassword) {
        throw new Error('Both passwords must be provided for comparison');
    }

    try {
        const isMatch = await compare(plainPassword, hashedPassword);
        return isMatch;
    } catch (error) {
        throw new Error('Failed to compare passwords: ' + (error as Error).message);
    }
}

/**
 * Validates password strength against comprehensive security requirements
 * Requirements:
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character (!@#$%^&*)
 * 
 * @param password Password string to validate
 * @returns boolean indicating if password meets all security requirements
 * @throws Error if password is empty/undefined
 */
export function validatePasswordStrength(password: string): boolean {
    if (!password) {
        throw new Error('Password must not be empty');
    }

    // Minimum length check
    if (password.length < 8) {
        return false;
    }

    // Regular expressions for password requirements
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /[0-9]/.test(password);
    const hasSpecialChar = /[!@#$%^&*]/.test(password);

    // All requirements must be met
    return hasUpperCase && 
           hasLowerCase && 
           hasNumbers && 
           hasSpecialChar;
}