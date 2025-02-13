import { signIn } from 'next-auth/react'; // ^4.24.0
import CryptoJS from 'crypto-js'; // ^4.1.1
import { ApiClient } from './api';
import { 
    User, 
    UserRole, 
    AuthProvider, 
    AuthState, 
    AuthToken, 
    ROLE_PERMISSIONS,
    isValidUser,
    isValidAuthToken,
    hasPermission
} from '../types/auth';

// Constants for authentication configuration
const AUTH_STORAGE_KEY = 'auth_state_v2';
const TOKEN_EXPIRY_BUFFER = 300; // 5 minutes in seconds
const MAX_LOGIN_ATTEMPTS = 3;
const TOKEN_REFRESH_INTERVAL = 60000; // 1 minute in milliseconds

/**
 * Enhanced TokenManager for secure token handling
 */
class TokenManager {
    private readonly encryptionKey: string;

    constructor() {
        this.encryptionKey = process.env.NEXT_PUBLIC_TOKEN_ENCRYPTION_KEY || 'default-key';
    }

    public encryptToken(token: AuthToken): string {
        return CryptoJS.AES.encrypt(JSON.stringify(token), this.encryptionKey).toString();
    }

    public decryptToken(encryptedToken: string): AuthToken | null {
        try {
            const decrypted = CryptoJS.AES.decrypt(encryptedToken, this.encryptionKey).toString(CryptoJS.enc.Utf8);
            const token = JSON.parse(decrypted);
            return isValidAuthToken(token) ? token : null;
        } catch {
            return null;
        }
    }
}

/**
 * Session Manager for handling user sessions across browser tabs
 */
class SessionManager {
    private readonly storageKey: string;
    private readonly broadcastChannel: BroadcastChannel;

    constructor(storageKey: string) {
        this.storageKey = storageKey;
        this.broadcastChannel = new BroadcastChannel('auth_sync');
        this.setupBroadcastListener();
    }

    private setupBroadcastListener(): void {
        this.broadcastChannel.onmessage = (event) => {
            if (event.data.type === 'AUTH_STATE_CHANGE') {
                this.syncState(event.data.state);
            }
        };
    }

    public getState(): AuthState | null {
        try {
            const stored = localStorage.getItem(this.storageKey);
            return stored ? JSON.parse(stored) : null;
        } catch {
            return null;
        }
    }

    public setState(state: AuthState): void {
        localStorage.setItem(this.storageKey, JSON.stringify(state));
        this.broadcastChannel.postMessage({ type: 'AUTH_STATE_CHANGE', state });
    }

    private syncState(state: AuthState): void {
        localStorage.setItem(this.storageKey, JSON.stringify(state));
    }
}

/**
 * Enhanced AuthService with comprehensive security features
 */
export class AuthService {
    private readonly apiClient: ApiClient;
    private readonly tokenManager: TokenManager;
    private readonly sessionManager: SessionManager;
    private refreshTimer?: NodeJS.Timeout;
    private loginAttempts: Map<string, number>;
    private lastLoginAttempt: Map<string, number>;

    constructor(apiClient: ApiClient) {
        this.apiClient = apiClient;
        this.tokenManager = new TokenManager();
        this.sessionManager = new SessionManager(AUTH_STORAGE_KEY);
        this.loginAttempts = new Map();
        this.lastLoginAttempt = new Map();
        this.initializeAuthState();
    }

    /**
     * Enhanced login with rate limiting and multiple provider support
     */
    public async login(email: string, password: string, provider: AuthProvider = AuthProvider.LOCAL): Promise<AuthState> {
        this.checkRateLimit(email);

        try {
            let token: AuthToken;
            
            if (provider === AuthProvider.LOCAL) {
                token = await this.apiClient.login({ email, password });
            } else {
                const result = await signIn(provider.toLowerCase(), { redirect: false });
                if (!result?.ok) {
                    throw new Error('OAuth authentication failed');
                }
                token = await this.apiClient.validateToken(result.token as string);
            }

            const user = await this.apiClient.getUser();
            if (!isValidUser(user)) {
                throw new Error('Invalid user data received');
            }

            const authState: AuthState = {
                user,
                loading: false,
                error: null
            };

            this.setupTokenRefresh(token);
            this.sessionManager.setState(authState);
            this.resetLoginAttempts(email);

            return authState;
        } catch (error) {
            this.incrementLoginAttempts(email);
            throw error;
        }
    }

    /**
     * Enhanced permission checking with caching
     */
    public async checkPermission(permission: string, user: User, resource?: string): Promise<boolean> {
        if (!user || !user.role) {
            return false;
        }

        const cacheKey = `perm_${user.id}_${permission}_${resource || ''}`;
        const cached = this.getPermissionFromCache(cacheKey);
        if (cached !== undefined) {
            return cached;
        }

        const hasAccess = await this.validatePermission(user.role, permission, resource);
        this.cachePermission(cacheKey, hasAccess);
        return hasAccess;
    }

    /**
     * Token refresh with retry logic
     */
    private async refreshToken(): Promise<void> {
        try {
            const currentState = this.sessionManager.getState();
            if (!currentState?.user) {
                return;
            }

            const token = await this.apiClient.refreshToken();
            if (!isValidAuthToken(token)) {
                throw new Error('Invalid refresh token response');
            }

            this.setupTokenRefresh(token);
        } catch (error) {
            this.handleRefreshError(error);
        }
    }

    /**
     * Initialize authentication state from storage
     */
    private initializeAuthState(): void {
        const storedState = this.sessionManager.getState();
        if (storedState?.user) {
            this.validateStoredState(storedState);
        }
    }

    /**
     * Rate limiting implementation
     */
    private checkRateLimit(email: string): void {
        const attempts = this.loginAttempts.get(email) || 0;
        const lastAttempt = this.lastLoginAttempt.get(email) || 0;
        const now = Date.now();

        if (attempts >= MAX_LOGIN_ATTEMPTS) {
            const timeSinceLastAttempt = now - lastAttempt;
            if (timeSinceLastAttempt < 300000) { // 5 minutes lockout
                throw new Error('Too many login attempts. Please try again later.');
            }
            this.resetLoginAttempts(email);
        }
    }

    private incrementLoginAttempts(email: string): void {
        const attempts = (this.loginAttempts.get(email) || 0) + 1;
        this.loginAttempts.set(email, attempts);
        this.lastLoginAttempt.set(email, Date.now());
    }

    private resetLoginAttempts(email: string): void {
        this.loginAttempts.delete(email);
        this.lastLoginAttempt.delete(email);
    }

    /**
     * Permission validation with role hierarchy
     */
    private async validatePermission(role: UserRole, permission: string, resource?: string): Promise<boolean> {
        const rolePermissions = ROLE_PERMISSIONS[role];
        if (rolePermissions.includes('*')) {
            return true;
        }

        if (resource) {
            const resourcePermission = `${permission}:${resource}`;
            return rolePermissions.includes(resourcePermission) || rolePermissions.includes(`${permission}:*`);
        }

        return rolePermissions.includes(permission);
    }

    /**
     * Permission caching implementation
     */
    private permissionCache: Map<string, { value: boolean; timestamp: number }> = new Map();
    private readonly PERMISSION_CACHE_DURATION = 300000; // 5 minutes

    private getPermissionFromCache(key: string): boolean | undefined {
        const cached = this.permissionCache.get(key);
        if (cached && Date.now() - cached.timestamp < this.PERMISSION_CACHE_DURATION) {
            return cached.value;
        }
        return undefined;
    }

    private cachePermission(key: string, value: boolean): void {
        this.permissionCache.set(key, { value, timestamp: Date.now() });
    }

    /**
     * Token refresh setup with error handling
     */
    private setupTokenRefresh(token: AuthToken): void {
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
        }

        const refreshTime = (token.expiresIn - TOKEN_EXPIRY_BUFFER) * 1000;
        this.refreshTimer = setInterval(() => this.refreshToken(), Math.min(refreshTime, TOKEN_REFRESH_INTERVAL));
    }

    private handleRefreshError(error: any): void {
        console.error('Token refresh failed:', error);
        this.logout();
    }

    /**
     * Logout implementation with cleanup
     */
    public async logout(): Promise<void> {
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
        }
        
        this.sessionManager.setState({
            user: null,
            loading: false,
            error: null
        });
        
        this.permissionCache.clear();
        await this.apiClient.logout();
    }
}