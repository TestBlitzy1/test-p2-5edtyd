# Node.js build stage
FROM node:18-alpine AS node-build-base

WORKDIR /usr/src/app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files and install dependencies
COPY package*.json ./
COPY lerna.json ./
RUN npm ci

# Copy source code and build
COPY tsconfig.json ./
COPY . .
RUN npm run build
RUN npm prune --production

# Python build stage
FROM python:3.11-slim AS python-build-base

WORKDIR /usr/src/app

# Install system dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements*.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY . .
ENV PYTHONPATH=/usr/src/app

# Node.js production runtime
FROM node:18-alpine AS node-runtime-base

WORKDIR /usr/src/app

# Copy built artifacts and dependencies
COPY --from=node-build-base /usr/src/app/dist ./dist
COPY --from=node-build-base /usr/src/app/node_modules ./node_modules

# Set production environment
ENV NODE_ENV=production

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs

# Set user
USER nodejs

# Configure security headers
ENV NODE_OPTIONS="--max-old-space-size=2048 --max-http-header-size=16384"

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Python production runtime
FROM python:3.11-slim AS python-runtime-base

WORKDIR /usr/src/app

# Copy built artifacts
COPY --from=python-build-base /usr/src/app /usr/src/app

# Install runtime dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set production environment
ENV PYTHONPATH=/usr/src/app
ENV PYTHONUNBUFFERED=1

# Create non-root user
RUN groupadd -g 1001 appuser && \
    useradd -r -u 1001 -g appuser appuser

# Set permissions
RUN chown -R appuser:appuser /usr/src/app

# Set user
USER appuser

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl --fail http://localhost:8000/health || exit 1

# Note: Final image selection should be done in service-specific Dockerfiles
# using "FROM node-runtime-base" or "FROM python-runtime-base"