# Build stage
FROM node:18-alpine AS builder

# Install build dependencies
RUN apk add --no-cache --virtual .build-deps \
    python3 \
    make \
    g++ \
    && apk add --no-cache tzdata

# Set working directory
WORKDIR /usr/src/app

# Copy package files with specific ownership
COPY --chown=node:node package*.json ./
COPY --chown=node:node tsconfig*.json ./

# Install dependencies with exact versions
RUN npm ci --ignore-scripts

# Copy source code and config files
COPY --chown=node:node . .

# Build TypeScript code with optimizations
RUN npm run build \
    && npm run test \
    && npm audit \
    && npm prune --production \
    && apk del .build-deps

# Production stage
FROM node:18-alpine

# Create non-root user
RUN addgroup -g 1001 campaignservice && \
    adduser -u 1001 -G campaignservice -s /bin/sh -D campaignservice

# Set working directory
WORKDIR /usr/src/app

# Copy package files
COPY --chown=campaignservice:campaignservice package*.json ./

# Install production dependencies only
RUN npm ci --production --ignore-scripts

# Copy compiled files from builder
COPY --chown=campaignservice:campaignservice --from=builder /usr/src/app/dist ./dist

# Set secure file permissions
RUN chmod -R 550 . \
    && chmod -R 770 node_modules \
    && chown -R campaignservice:campaignservice .

# Set environment variables
ENV NODE_ENV=production \
    PORT=3000 \
    NODE_OPTIONS="--max-old-space-size=4096" \
    TZ=UTC

# Set resource limits
RUN ulimit -n 65535

# Configure health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT}/health || exit 1

# Labels for container metadata
LABEL maintainer="DevOps Team <devops@company.com>" \
    version="1.0.0" \
    service="campaign-service" \
    environment="production"

# Expose service port
EXPOSE ${PORT}

# Switch to non-root user
USER campaignservice

# Start application with clustering
CMD ["node", "--require", "source-map-support/register", "dist/app.js"]