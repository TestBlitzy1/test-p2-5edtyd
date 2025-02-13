# Build stage
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files for better layer caching
COPY package*.json ./
COPY tsconfig*.json ./

# Install all dependencies including dev dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Run tests
RUN npm test

# Remove dev dependencies
RUN npm prune --production

# Production stage
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Create non-root user
RUN addgroup -S platform && \
    adduser -S platform -G platform

# Install production dependencies
RUN apk add --no-cache tini

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3002
ENV MAX_MEMORY=2048M
ENV GRACEFUL_SHUTDOWN_TIMEOUT=10000
ENV COMPRESSION_LEVEL=6
ENV RATE_LIMIT_WINDOW=15m
ENV RATE_LIMIT_MAX_REQUESTS=100

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy compiled files from builder
COPY --from=builder /app/dist ./dist

# Copy necessary configuration files
COPY --from=builder /app/node_modules ./node_modules

# Create required directories with correct permissions
RUN mkdir -p /app/logs && \
    chown -R platform:platform /app

# Set security headers and restrictions
RUN echo "net.core.somaxconn=65535" >> /etc/sysctl.conf

# Set up health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT}/health || exit 1

# Switch to non-root user
USER platform

# Expose service port
EXPOSE ${PORT}

# Use tini as init system
ENTRYPOINT ["/sbin/tini", "--"]

# Start the application with clustering enabled
CMD ["node", "--max-old-space-size=2048", "--enable-source-maps", "dist/app.js"]