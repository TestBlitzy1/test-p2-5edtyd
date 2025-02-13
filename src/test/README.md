# Sales Intelligence Platform Test Suite Documentation

## Table of Contents
- [Overview](#overview)
- [Test Categories](#test-categories)
- [Environment Setup](#environment-setup)
- [Test Execution](#test-execution)
- [Coverage Requirements](#coverage-requirements)
- [Mock Services](#mock-services)
- [Troubleshooting](#troubleshooting)

## Overview

The Sales Intelligence Platform test suite provides comprehensive testing coverage across all system components including campaign generation, platform integration, analytics, and security features. The test framework is built using Jest (v29.0.0) with support for TypeScript and includes specialized testing tools for different test categories.

### Key Features
- Multi-category test support (unit, integration, E2E, security, performance)
- Docker-based isolated test environment
- Automated CI/CD integration
- Comprehensive mock service implementations
- Performance and load testing capabilities
- Security vulnerability scanning

## Test Categories

### Unit Tests
```bash
npm run test:unit
```
- Location: `<rootDir>/unit/**/*.spec.ts`
- Coverage threshold: 80% (branches, functions, lines, statements)
- Focuses on individual component testing
- Mock external dependencies

### Integration Tests
```bash
npm run test:integration
```
- Location: `<rootDir>/integration/**/*.spec.ts`
- Tests service interactions
- Uses containerized dependencies
- Validates API contracts

### End-to-End Tests
```bash
npm run test:e2e
```
- Location: `<rootDir>/e2e/**/*.spec.ts`
- Full system flow validation
- Platform API integration testing
- User journey validation

### Security Tests
```bash
npm run test:security
```
- Location: `<rootDir>/security/**/*.spec.ts`
- Vulnerability scanning
- Authentication/Authorization testing
- Data encryption validation

### Performance Tests
```bash
npm run test:performance
```
- Location: `<rootDir>/performance/**/*.spec.ts`
- Response time validation (<100ms)
- Concurrent user testing (10k users)
- Resource utilization monitoring

## Environment Setup

### Prerequisites
- Node.js >= 18.0.0
- Docker >= 24.0.0
- Docker Compose >= 2.20.0

### Installation
```bash
# Install dependencies
npm install

# Build test containers
docker-compose -f docker/docker-compose.test.yml build

# Start test environment
docker-compose -f docker/docker-compose.test.yml up -d
```

### Environment Variables
```bash
# Test configuration
TEST_MODE=true
TEST_COVERAGE_ENABLED=true
TEST_COVERAGE_THRESHOLD=80

# Database configuration
POSTGRES_HOST=test_db
POSTGRES_PORT=5432
POSTGRES_DB=test_db
POSTGRES_USER=test_user

# Service endpoints
API_GATEWAY_URL=http://test_api_gateway:4000
AUTH_SERVICE_URL=http://test_auth_service:4001
CAMPAIGN_SERVICE_URL=http://test_campaign_service:4002
```

## Test Execution

### Running All Tests
```bash
npm run test:ci
```

### Watch Mode
```bash
npm run test:watch
```

### Coverage Report
```bash
npm run test:coverage
```

### Load Testing
```bash
npm run test:load
```

## Coverage Requirements

### Minimum Thresholds
```javascript
coverageThreshold: {
  global: {
    branches: 80,
    functions: 80,
    lines: 80,
    statements: 80
  }
}
```

### Report Generation
- HTML reports: `coverage/lcov-report/index.html`
- JSON reports: `coverage/coverage-final.json`
- JUnit reports: `coverage/junit.xml`

## Mock Services

### LinkedIn Ads API Mock
- Location: `mocks/linkedin-ads-api`
- Simulates campaign creation/management
- Implements error scenarios
- Validates request payloads

### Google Ads API Mock
- Location: `mocks/google-ads-api`
- Supports campaign operations
- Performance metrics simulation
- Error handling validation

### Authentication Mock
```javascript
jest.mock('@auth/service', () => ({
  validateToken: jest.fn().mockResolvedValue(true),
  generateToken: jest.fn().mockReturnValue('mock-token')
}));
```

## Troubleshooting

### Common Issues

#### Test Container Startup
```bash
# Check container logs
docker-compose -f docker/docker-compose.test.yml logs

# Verify health checks
docker ps --format "{{.Names}}: {{.Status}}"
```

#### Database Connection
```bash
# Reset test database
docker-compose -f docker/docker-compose.test.yml exec test_db psql -U test_user -d test_db
```

#### Performance Issues
```bash
# Monitor resource usage
docker stats

# Check test execution times
npm run test:ci --verbose
```

### Debug Mode
```bash
# Enable debug logging
DEBUG=test:* npm run test

# Remote debugging
NODE_OPTIONS="--inspect-brk" npm run test
```

### Log Files
- Test logs: `logs/test.log`
- Performance metrics: `logs/performance.log`
- Error reports: `logs/error.log`