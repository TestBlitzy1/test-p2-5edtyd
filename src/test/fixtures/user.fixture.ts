import { faker } from '@faker-js/faker';
import { 
    IUser, 
    UserRole, 
    AuthProvider 
} from '../../backend/shared/types/auth.types';

/**
 * Creates a comprehensive test user fixture with specified role and provider
 * @param role - User role (defaults to USER)
 * @param provider - Authentication provider (defaults to LOCAL)
 * @returns Complete test user object
 */
export const createTestUser = (
    role: UserRole = UserRole.USER,
    provider: AuthProvider = AuthProvider.LOCAL
): IUser => {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const email = faker.internet.email({ firstName, lastName }).toLowerCase();
    
    return {
        id: faker.string.uuid(),
        email,
        password: provider === AuthProvider.LOCAL ? 
            faker.internet.password({ length: 12, memorable: true }) : 
            null,
        role,
        provider,
        providerId: provider !== AuthProvider.LOCAL ? 
            faker.string.alphanumeric(24) : 
            null,
        firstName,
        lastName,
        isEmailVerified: provider !== AuthProvider.LOCAL || faker.datatype.boolean(),
        lastLoginAt: faker.date.recent({ days: 7 }),
        createdAt: faker.date.past({ years: 1 }),
        updatedAt: faker.date.recent()
    };
};

/**
 * Creates an array of test users with distributed roles and providers
 * @param count - Number of test users to create
 * @returns Array of test user objects
 */
export const createTestUsers = (count: number): IUser[] => {
    const users: IUser[] = [];
    const roles = Object.values(UserRole);
    const providers = Object.values(AuthProvider);

    // Ensure at least one user of each role
    roles.forEach(role => {
        users.push(createTestUser(role, AuthProvider.LOCAL));
    });

    // Generate remaining users with distributed roles and providers
    for (let i = roles.length; i < count; i++) {
        const role = roles[i % roles.length];
        const provider = providers[i % providers.length];
        users.push(createTestUser(role, provider));
    }

    return users;
};

/**
 * Standard admin user fixture for testing administrative functionality
 */
export const testUserAdmin: IUser = createTestUser(UserRole.ADMIN, AuthProvider.LOCAL);

/**
 * Standard manager user fixture for testing manager-level permissions
 */
export const testUserManager: IUser = createTestUser(UserRole.MANAGER, AuthProvider.LOCAL);

/**
 * Standard analyst user fixture for testing analytics access
 */
export const testUserAnalyst: IUser = createTestUser(UserRole.ANALYST, AuthProvider.LOCAL);

/**
 * Standard user fixture for testing basic user functionality
 */
export const testUserBasic: IUser = createTestUser(UserRole.USER, AuthProvider.LOCAL);

/**
 * OAuth user fixtures for testing third-party authentication
 */
export const testUserGoogle: IUser = createTestUser(UserRole.USER, AuthProvider.GOOGLE);
export const testUserLinkedIn: IUser = createTestUser(UserRole.USER, AuthProvider.LINKEDIN);

/**
 * Collection of all standard test users for easy import
 */
export const standardTestUsers = {
    admin: testUserAdmin,
    manager: testUserManager,
    analyst: testUserAnalyst,
    basic: testUserBasic,
    google: testUserGoogle,
    linkedIn: testUserLinkedIn
};