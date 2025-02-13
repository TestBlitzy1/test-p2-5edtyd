import jwt from 'jsonwebtoken'; // ^9.0.0
import { 
  generateTokenPayload,
  generateAccessToken,
  generateRefreshToken,
  generateAuthTokens,
  verifyToken
} from '../../../backend/auth-service/src/utils/jwt.utils';
import { testUserAdmin } from '../../fixtures/user.fixture';
import { UserRole, AuthProvider } from '../../../backend/shared/types/auth.types';
import { jwt as jwtConfig } from '../../../backend/auth-service/src/config';

describe('Authentication Utility Tests', () => {
  describe('generateTokenPayload', () => {
    it('should generate valid token payload with all required fields', () => {
      const payload = generateTokenPayload(testUserAdmin);

      expect(payload).toEqual(expect.objectContaining({
        userId: testUserAdmin.id,
        email: testUserAdmin.email.toLowerCase(),
        role: UserRole.ADMIN,
        provider: AuthProvider.LOCAL,
        iss: jwtConfig.issuer,
        sub: testUserAdmin.id
      }));

      expect(payload.iat).toBeDefined();
      expect(payload.exp).toBeDefined();
      expect(payload.jti).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      expect(payload.fingerprint).toMatch(/^[a-f0-9]{64}$/i);
    });

    it('should include correct admin scope for admin users', () => {
      const payload = generateTokenPayload(testUserAdmin);
      expect(payload.scope).toContain('admin:all');
      expect(payload.scope).toContain('write:all');
      expect(payload.scope).toContain('delete:all');
    });

    it('should throw error for invalid user data', () => {
      const invalidUser = { ...testUserAdmin, id: undefined };
      expect(() => generateTokenPayload(invalidUser as any)).toThrow('Invalid user data for token generation');
    });

    it('should sanitize email in payload', () => {
      const userWithMixedCaseEmail = { 
        ...testUserAdmin, 
        email: 'Test.User@Example.com  '
      };
      const payload = generateTokenPayload(userWithMixedCaseEmail);
      expect(payload.email).toBe('test.user@example.com');
    });
  });

  describe('generateAccessToken', () => {
    const mockPayload = generateTokenPayload(testUserAdmin);

    it('should generate valid JWT access token', () => {
      const token = generateAccessToken(mockPayload);
      expect(token).toMatch(/^[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*$/);
    });

    it('should include correct JWT headers', () => {
      const token = generateAccessToken(mockPayload);
      const decoded = jwt.decode(token, { complete: true });
      expect(decoded?.header).toEqual({
        alg: jwtConfig.algorithm,
        typ: 'JWT'
      });
    });

    it('should set correct token expiration', () => {
      const token = generateAccessToken(mockPayload);
      const decoded = jwt.decode(token) as jwt.JwtPayload;
      const expectedExp = Math.floor(Date.now() / 1000) + parseInt(jwtConfig.expiry);
      expect(decoded.exp).toBeCloseTo(expectedExp, -2);
    });

    it('should throw error for invalid payload', () => {
      const invalidPayload = { ...mockPayload, userId: undefined };
      expect(() => generateAccessToken(invalidPayload)).toThrow('Invalid payload for access token generation');
    });
  });

  describe('generateRefreshToken', () => {
    const mockPayload = generateTokenPayload(testUserAdmin);

    it('should generate valid JWT refresh token with extended expiry', () => {
      const token = generateRefreshToken(mockPayload);
      const decoded = jwt.decode(token) as jwt.JwtPayload;
      expect(decoded.exp).toBeDefined();
      expect(decoded.tokenType).toBe('refresh');
    });

    it('should include rotation tracking metadata', () => {
      const token = generateRefreshToken(mockPayload);
      const decoded = jwt.decode(token) as jwt.JwtPayload;
      expect(decoded.rotationCounter).toBe(0);
      expect(decoded.fingerprint).toMatch(/^[a-f0-9]{64}$/i);
    });

    it('should use stronger algorithm for refresh tokens', () => {
      const token = generateRefreshToken(mockPayload);
      const decoded = jwt.decode(token, { complete: true });
      expect(decoded?.header.alg).toBe('HS512');
    });

    it('should throw error for invalid payload', () => {
      const invalidPayload = { ...mockPayload, email: undefined };
      expect(() => generateRefreshToken(invalidPayload)).toThrow('Invalid payload for refresh token generation');
    });
  });

  describe('generateAuthTokens', () => {
    it('should generate valid access and refresh token pair', () => {
      const tokens = generateAuthTokens(testUserAdmin);
      expect(tokens).toEqual({
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
        expiresIn: parseInt(jwtConfig.expiry),
        tokenType: jwtConfig.tokenType,
        scope: expect.any(Array)
      });
    });

    it('should include admin scopes for admin users', () => {
      const tokens = generateAuthTokens(testUserAdmin);
      expect(tokens.scope).toContain('admin:all');
      expect(tokens.scope).toContain('write:all');
    });

    it('should throw error for invalid user data', () => {
      const invalidUser = { ...testUserAdmin, role: undefined };
      expect(() => generateAuthTokens(invalidUser as any)).toThrow('Invalid user data for token generation');
    });

    it('should generate tokens with matching subject claims', () => {
      const tokens = generateAuthTokens(testUserAdmin);
      const accessDecoded = jwt.decode(tokens.accessToken) as jwt.JwtPayload;
      const refreshDecoded = jwt.decode(tokens.refreshToken) as jwt.JwtPayload;
      expect(accessDecoded.sub).toBe(refreshDecoded.sub);
    });
  });

  describe('verifyToken', () => {
    let validToken: string;

    beforeEach(() => {
      const payload = generateTokenPayload(testUserAdmin);
      validToken = generateAccessToken(payload);
    });

    it('should verify and decode valid token', () => {
      const decoded = verifyToken(validToken);
      expect(decoded).toEqual(expect.objectContaining({
        userId: testUserAdmin.id,
        email: testUserAdmin.email.toLowerCase(),
        role: UserRole.ADMIN
      }));
    });

    it('should reject expired tokens', () => {
      jest.spyOn(jwt, 'verify').mockImplementation(() => {
        throw new jwt.TokenExpiredError('Token expired', new Date());
      });
      expect(() => verifyToken(validToken)).toThrow('Token has expired');
    });

    it('should reject tampered tokens', () => {
      const tamperedToken = validToken.slice(0, -5) + 'xxxxx';
      expect(() => verifyToken(tamperedToken)).toThrow('Invalid token signature');
    });

    it('should validate refresh token specific claims', () => {
      const payload = generateTokenPayload(testUserAdmin);
      const refreshToken = generateRefreshToken(payload);
      const decoded = verifyToken(refreshToken);
      expect(decoded.tokenType).toBe('refresh');
      expect(decoded.rotationCounter).toBe(0);
    });

    it('should throw error for missing token', () => {
      expect(() => verifyToken('')).toThrow('Token is required for verification');
    });

    it('should validate token fingerprint', () => {
      const tokenWithoutFingerprint = jwt.sign(
        { ...generateTokenPayload(testUserAdmin), fingerprint: undefined },
        jwtConfig.secret
      );
      expect(() => verifyToken(tokenWithoutFingerprint)).toThrow('Invalid token claims');
    });
  });
});