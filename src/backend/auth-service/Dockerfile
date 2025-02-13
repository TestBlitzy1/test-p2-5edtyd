# Build stage
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig*.json ./

# Install dependencies and build tools
RUN npm ci && \
    # Audit dependencies for security vulnerabilities
    npm audit fix --production && \
    # Install TypeScript globally for build
    npm install -g typescript@5.0.0

# Copy source code
COPY src/ ./src/

# Build TypeScript code
RUN npm run build && \
    # Remove dev dependencies
    npm prune --production

# Production stage
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install PM2 globally
RUN npm install -g pm2@5.3.0 && \
    # Create non-root user
    addgroup -S authservice && \
    adduser -S authservice -G authservice && \
    # Create necessary directories with proper permissions
    mkdir -p /app/logs && \
    chown -R authservice:authservice /app

# Copy production dependencies and compiled code
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

# Set security configurations
RUN apk add --no-cache curl && \
    # Set proper permissions
    chmod -R 550 /app/dist && \
    chmod -R 550 /app/node_modules && \
    chmod 660 /app/package.json && \
    chmod -R 770 /app/logs

# Switch to non-root user
USER authservice

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose service port
EXPOSE 3000

# Health check configuration
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

# Start the service with PM2
ENTRYPOINT ["pm2-runtime", "start", "dist/app.js", "--name", "auth-service"]