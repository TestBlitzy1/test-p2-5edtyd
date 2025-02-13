# Build stage
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++ git

# Copy package files
COPY package*.json ./
COPY jest.config.js ./
COPY tsconfig.json ./

# Install all dependencies including devDependencies
RUN npm ci

# Copy source code and test files
COPY src/ ./src/
COPY test/ ./test/
COPY utils/ ./utils/
COPY fixtures/ ./fixtures/
COPY mocks/ ./mocks/

# Build TypeScript files
RUN npm run type-check
RUN npm run lint
RUN npm run clean && tsc -p tsconfig.json

# Run security audit
RUN npm audit

# Test stage
FROM node:18-alpine AS tester

# Install k6 for performance testing
COPY --from=grafana/k6:0.45.0 /usr/bin/k6 /usr/bin/k6

# Set working directory
WORKDIR /app

# Set environment variables
ENV NODE_ENV=test
ENV TEST_MODE=true
ENV TEST_COVERAGE_THRESHOLD=80
ENV MAX_MEMORY=4g
ENV MAX_CPU=2

# Create non-root user
RUN addgroup -S tester && adduser -S tester -G tester

# Install production dependencies
COPY package*.json ./
RUN npm ci --production

# Copy built files from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/test ./test
COPY --from=builder /app/utils ./utils
COPY --from=builder /app/fixtures ./fixtures
COPY --from=builder /app/mocks ./mocks
COPY --from=builder /app/jest.config.js ./

# Create directories for test artifacts
RUN mkdir -p coverage test-results performance-reports \
    && chown -R tester:tester /app

# Set up volume mount points
VOLUME ["/app/coverage", "/app/test-results", "/app/performance-reports"]

# Configure test service endpoints
ENV POSTGRES_HOST=test_db \
    REDIS_HOST=test_cache \
    API_GATEWAY_URL=http://test_api_gateway:4000 \
    AUTH_SERVICE_URL=http://test_auth_service:4001 \
    CAMPAIGN_SERVICE_URL=http://test_campaign_service:4002 \
    ANALYTICS_SERVICE_URL=http://test_analytics_service:4003 \
    PLATFORM_SERVICE_URL=http://test_platform_integration:4004 \
    AI_SERVICE_URL=http://test_ai_service:8001

# Switch to non-root user
USER tester

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node utils/healthcheck.js

# Resource constraints
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Default command to run all tests
CMD ["npm", "run", "test:all"]

# Test execution commands available as alternatives:
# npm run test:unit         - Run unit tests with coverage
# npm run test:integration  - Run integration tests
# npm run test:e2e         - Run end-to-end tests
# npm run test:security    - Run security tests
# npm run test:performance - Run performance tests
# npm run test:load        - Run load tests