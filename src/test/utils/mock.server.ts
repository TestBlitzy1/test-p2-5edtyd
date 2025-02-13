import express, { Express, Request, Response, NextFunction } from 'express';
import { IUser, UserRole, IAuthToken } from '../../backend/shared/types/auth.types';
import { ICampaign, CampaignStatus } from '../../backend/shared/types/campaign.types';
import { IAnalytics, MetricType, TimeGranularity } from '../../backend/shared/types/analytics.types';

/**
 * Configuration options for MockServer instance
 */
interface IMockServerOptions {
  simulatedLatency?: number;
  enableLogging?: boolean;
  defaultErrorRate?: number;
}

/**
 * Mock response configuration
 */
interface IMockResponseOptions {
  status?: number;
  delay?: number;
  errorRate?: number;
}

/**
 * MockServer class for simulating backend API responses in test environments
 * @version 1.0.0
 */
export class MockServer {
  private app: Express;
  private mockResponses: Map<string, any>;
  private routeHandlers: Map<string, Function>;
  private simulatedLatency: number;
  private errorRate: number;

  constructor(port: number = 3001, options: IMockServerOptions = {}) {
    this.app = express();
    this.mockResponses = new Map();
    this.routeHandlers = new Map();
    this.simulatedLatency = options.simulatedLatency || 0;
    this.errorRate = options.defaultErrorRate || 0;

    // Configure middleware
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // Setup default error handling
    this.setupErrorHandling();

    // Initialize routes
    this.setupAuthRoutes();
    this.setupCampaignRoutes();
    this.setupAnalyticsRoutes();

    // Start server
    if (port) {
      this.app.listen(port);
    }
  }

  /**
   * Configure authentication-related mock routes
   */
  private setupAuthRoutes(): void {
    // Login endpoint
    this.app.post('/api/auth/login', this.createHandler<IAuthToken>('auth/login', {
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
      expiresIn: 3600,
      tokenType: 'Bearer',
      scope: ['read', 'write']
    }));

    // User profile endpoint
    this.app.get('/api/auth/profile', this.createHandler<IUser>('auth/profile', {
      id: 'mock-user-id',
      email: 'test@example.com',
      role: UserRole.MANAGER,
      firstName: 'Test',
      lastName: 'User',
      isEmailVerified: true,
      lastLoginAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    }));
  }

  /**
   * Configure campaign management mock routes
   */
  private setupCampaignRoutes(): void {
    // Campaign list endpoint
    this.app.get('/api/campaigns', this.createHandler<ICampaign[]>('campaigns/list', []));

    // Campaign detail endpoint
    this.app.get('/api/campaigns/:id', this.createHandler<ICampaign>('campaigns/detail', {
      id: 'mock-campaign-id',
      name: 'Mock Campaign',
      status: CampaignStatus.ACTIVE
    }));

    // Campaign creation endpoint
    this.app.post('/api/campaigns', this.createHandler<ICampaign>('campaigns/create'));

    // Campaign update endpoint
    this.app.put('/api/campaigns/:id', this.createHandler<ICampaign>('campaigns/update'));

    // Campaign deletion endpoint
    this.app.delete('/api/campaigns/:id', this.createHandler<void>('campaigns/delete'));
  }

  /**
   * Configure analytics and metrics mock routes
   */
  private setupAnalyticsRoutes(): void {
    // Analytics data endpoint
    this.app.get('/api/analytics', this.createHandler<IAnalytics>('analytics/data', {
      id: 'mock-analytics-id',
      campaignId: 'mock-campaign-id',
      userId: 'mock-user-id',
      metrics: [
        {
          type: MetricType.IMPRESSIONS,
          value: 1000,
          timestamp: new Date()
        }
      ],
      startDate: new Date(),
      endDate: new Date(),
      granularity: TimeGranularity.DAILY
    }));
  }

  /**
   * Create a route handler with error simulation and response delay
   */
  private createHandler<T>(route: string, defaultResponse?: T) {
    return async (req: Request, res: Response) => {
      try {
        // Simulate network latency
        if (this.simulatedLatency > 0) {
          await new Promise(resolve => setTimeout(resolve, this.simulatedLatency));
        }

        // Simulate random errors based on error rate
        if (Math.random() < this.errorRate) {
          throw new Error('Simulated error');
        }

        const mockResponse = this.mockResponses.get(route) || defaultResponse;
        const handler = this.routeHandlers.get(route);

        if (handler) {
          const response = await handler(req, mockResponse);
          res.json(response);
        } else {
          res.json(mockResponse);
        }
      } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
      }
    };
  }

  /**
   * Configure global error handling
   */
  private setupErrorHandling(): void {
    this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      console.error('Mock Server Error:', err);
      res.status(500).json({ error: err.message });
    });
  }

  /**
   * Set a mock response for a specific route
   */
  public setMockResponse<T>(route: string, response: T, options: IMockResponseOptions = {}): void {
    this.mockResponses.set(route, response);
    
    if (options.delay !== undefined) {
      this.simulatedLatency = options.delay;
    }
    
    if (options.errorRate !== undefined) {
      this.errorRate = options.errorRate;
    }
  }

  /**
   * Set a custom route handler
   */
  public setRouteHandler(route: string, handler: Function): void {
    this.routeHandlers.set(route, handler);
  }

  /**
   * Clear all mock responses and handlers
   */
  public clearMockResponses(): void {
    this.mockResponses.clear();
    this.routeHandlers.clear();
    this.simulatedLatency = 0;
    this.errorRate = 0;
  }

  /**
   * Get the Express application instance for testing
   */
  public getApp(): Express {
    return this.app;
  }
}