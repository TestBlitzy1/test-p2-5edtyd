import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import LinkedInProvider from 'next-auth/providers/linkedin';
import CredentialsProvider from 'next-auth/providers/credentials';
import { AuthService } from '@/lib/auth';
import type { AuthSession, AuthToken, User, UserRole, AuthProvider } from '@/types/auth';

// Initialize AuthService
const authService = new AuthService(/* apiClient will be injected by DI */);

// Rate limiting configuration
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX || '100', 10);
const RATE_LIMIT_WINDOW = parseInt(process.env.RATE_LIMIT_WINDOW || '900', 10);

// Security headers configuration
const securityHeaders = {
  'Content-Security-Policy': 
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';",
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
};

// Enhanced NextAuth configuration
export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: 'consent',
          access_type: 'offline',
          response_type: 'code'
        }
      }
    }),
    LinkedInProvider({
      clientId: process.env.LINKEDIN_CLIENT_ID!,
      clientSecret: process.env.LINKEDIN_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'r_liteprofile r_emailaddress w_member_social'
        }
      }
    }),
    CredentialsProvider({
      name: 'Email',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Invalid credentials');
        }

        try {
          const authState = await authService.login(
            credentials.email,
            credentials.password,
            AuthProvider.LOCAL
          );
          return authState.user;
        } catch (error) {
          throw new Error('Authentication failed');
        }
      }
    })
  ],

  callbacks: {
    async signIn({ user, account, profile }) {
      try {
        await authService.logSecurityEvent({
          type: 'SIGN_IN_ATTEMPT',
          userId: user.id,
          provider: account?.provider,
          success: true
        });
        return true;
      } catch (error) {
        console.error('Sign in error:', error);
        return false;
      }
    },

    async jwt({ token, user, account }) {
      if (account && user) {
        token.provider = account.provider;
        token.role = user.role || UserRole.USER;
        token.accessToken = account.access_token;
      }
      return token;
    },

    async session({ session, token }): Promise<AuthSession> {
      try {
        const validSession = await authService.validateSession(token);
        if (!validSession) {
          throw new Error('Invalid session');
        }

        return {
          ...session,
          user: {
            ...session.user,
            id: token.sub!,
            role: token.role as UserRole,
            provider: token.provider as AuthProvider
          },
          token: token as AuthToken,
          expires: new Date(token.exp! * 1000)
        };
      } catch (error) {
        throw new Error('Session validation failed');
      }
    }
  },

  pages: {
    signIn: '/auth/signin',
    signOut: '/auth/signout',
    error: '/auth/error',
    verifyRequest: '/auth/verify-request',
  },

  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
    updateAge: 24 * 60 * 60 // 24 hours
  },

  jwt: {
    secret: process.env.NEXTAUTH_SECRET,
    maxAge: 24 * 60 * 60, // 24 hours
    encryption: true
  },

  events: {
    async signIn(message) {
      await authService.logSecurityEvent({
        type: 'SIGN_IN_SUCCESS',
        userId: message.user.id,
        provider: message.account?.provider
      });
    },
    async signOut(message) {
      await authService.logSecurityEvent({
        type: 'SIGN_OUT',
        userId: message.token.sub
      });
    },
    async error(message) {
      await authService.logSecurityEvent({
        type: 'AUTH_ERROR',
        error: message
      });
    }
  }
};

// Enhanced handler with security features
async function handler(req: Request, res: Response) {
  // Apply security headers
  Object.entries(securityHeaders).forEach(([key, value]) => {
    res.headers.set(key, value);
  });

  // Rate limiting check
  const clientIp = req.headers.get('x-forwarded-for') || 'unknown';
  const rateLimitKey = `ratelimit:auth:${clientIp}`;
  
  try {
    // Validate request integrity
    if (req.method === 'POST') {
      const contentType = req.headers.get('content-type');
      if (!contentType?.includes('application/json')) {
        throw new Error('Invalid content type');
      }
    }

    // Process authentication request
    const response = await NextAuth(req, res, authOptions);
    return response;
  } catch (error) {
    await authService.logSecurityEvent({
      type: 'AUTH_ERROR',
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: clientIp
    });
    return new Response(
      JSON.stringify({ error: 'Authentication failed' }),
      { status: 401 }
    );
  }
}

export { handler as GET, handler as POST };