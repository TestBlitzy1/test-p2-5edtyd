# Sales Intelligence Platform - Backend Services

## Table of Contents
- [Overview](#overview)
- [Architecture](#architecture)
- [Services](#services)
- [Setup Instructions](#setup-instructions)
- [Development Guidelines](#development-guidelines)
- [API Documentation](#api-documentation)
- [Security Guidelines](#security-guidelines)
- [Deployment](#deployment)
- [Monitoring](#monitoring)
- [Troubleshooting](#troubleshooting)

## Overview

The Sales Intelligence Platform backend implements a microservices architecture providing AI-powered campaign management and optimization across LinkedIn Ads and Google Ads platforms.

### Core Features
- AI-powered campaign structure generation
- Multi-platform campaign management (LinkedIn & Google Ads)
- Real-time performance analytics and optimization
- Secure authentication and authorization
- Comprehensive monitoring and observability

### Technology Stack
- Node.js (v18 LTS) for API Gateway and Auth Service
- Python (v3.11+) for AI Service
- PostgreSQL (v15+) for data persistence
- Redis (v7+) for caching and rate limiting
- Kubernetes for orchestration
- Prometheus & Grafana for monitoring

## Architecture

### Microservices
- **API Gateway**: Entry point for all client requests, handles routing and rate limiting
- **Auth Service**: Manages authentication, authorization and user management
- **Campaign Service**: Handles campaign creation and management
- **AI Service**: Provides AI-powered optimizations and recommendations
- **Analytics Service**: Processes and analyzes campaign performance data

### Communication
- REST APIs for synchronous service-to-service communication
- gRPC for high-performance internal communication
- Event-driven architecture for asynchronous operations

### Security
- JWT-based authentication with refresh token rotation
- Role-based access control (RBAC)
- Rate limiting and circuit breakers
- Data encryption at rest and in transit

## Setup Instructions

### Prerequisites
1. Node.js v18 LTS
2. Python 3.11+
3. PostgreSQL 15+
4. Redis 7+
5. Docker & Kubernetes

### Environment Setup
1. Clone the repository
2. Copy `.env.example` to `.env` for each service
3. Configure environment variables:
```bash
# API Gateway
API_GATEWAY_PORT=3000
JWT_SECRET=<secure-secret>
CORS_ORIGIN=http://localhost:3000

# Auth Service
AUTH_SERVICE_PORT=3001
DB_HOST=localhost
DB_PORT=5432
DB_NAME=auth_db

# Campaign Service
CAMPAIGN_SERVICE_PORT=3002
REDIS_HOST=localhost
REDIS_PORT=6379

# AI Service
AI_SERVICE_PORT=3003
OPENAI_API_KEY=<your-api-key>
```

### Database Setup
1. Create PostgreSQL databases:
```sql
CREATE DATABASE auth_db;
CREATE DATABASE campaign_db;
```

2. Run migrations:
```bash
npm run migrate:up
```

### Service Startup
1. Start services individually:
```bash
# API Gateway
cd src/backend/api-gateway
npm install
npm run start

# Auth Service
cd src/backend/auth-service
npm install
npm run start

# Campaign Service
cd src/backend/campaign-service
npm install
npm run start

# AI Service
cd src/backend/ai-service
pip install -r requirements.txt
python src/app.py
```

2. Or use Docker Compose:
```bash
docker-compose up -d
```

## Development Guidelines

### Code Style
- Follow TypeScript/Python style guides
- Use ESLint/Prettier for JavaScript/TypeScript
- Use Black/isort for Python
- Document all public APIs and functions

### Testing Requirements
- Unit tests with Jest/Pytest
- Integration tests with Supertest/Pytest
- Minimum 80% code coverage
- Performance testing with k6

### Git Workflow
1. Create feature branch from develop
2. Follow conventional commits
3. Submit PR for review
4. Squash merge to develop
5. Release from develop to main

## API Documentation

### Authentication
- POST /api/auth/register
- POST /api/auth/login
- POST /api/auth/refresh-token
- POST /api/auth/logout

### Campaign Management
- POST /api/campaigns
- GET /api/campaigns
- PUT /api/campaigns/:id
- DELETE /api/campaigns/:id
- POST /api/campaigns/:id/optimize

### Analytics
- GET /api/analytics/campaigns/:id
- GET /api/analytics/dashboard
- GET /api/analytics/performance

## Security Guidelines

### Authentication
- Use JWT with short expiration
- Implement refresh token rotation
- Enable MFA for sensitive operations
- Rate limit authentication endpoints

### Authorization
- Implement RBAC
- Validate permissions per endpoint
- Audit security events
- Sanitize user input

### Data Protection
- Encrypt sensitive data
- Use HTTPS only
- Implement CORS policies
- Regular security audits

## Deployment

### Kubernetes Setup
1. Apply configurations:
```bash
kubectl apply -f k8s/
```

2. Verify deployments:
```bash
kubectl get pods
kubectl get services
```

### CI/CD Pipeline
1. GitHub Actions workflow
2. Automated testing
3. Docker image building
4. Kubernetes deployment
5. Monitoring verification

## Monitoring

### Metrics Collection
- Prometheus for metrics
- Grafana for visualization
- ELK Stack for logs
- Jaeger for tracing

### Health Checks
- /health endpoint per service
- Readiness/liveness probes
- Resource monitoring
- Error rate tracking

## Troubleshooting

### Common Issues
1. Service connectivity
2. Database connection
3. Redis cache issues
4. Authentication errors

### Debug Tools
- Service logs
- Prometheus metrics
- Jaeger traces
- Kubernetes dashboard

### Support
Contact: devops@company.com
On-call: +1-xxx-xxx-xxxx