# Build stage
FROM node:18-alpine AS build

# Set working directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies with exact versions and only production
RUN npm ci --only=production

# Copy source code
COPY . .

# Build TypeScript code
RUN npm run build

# Remove dev dependencies
RUN npm prune --production

# Runtime stage
FROM node:18-alpine

# Set working directory
WORKDIR /usr/src/app

# Copy built assets from build stage
COPY --from=build /usr/src/app/dist ./dist
COPY --from=build /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/package*.json ./

# Create non-root user/group and set permissions
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -G nodejs && \
    chown -R nodejs:nodejs /usr/src/app

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000

# Switch to non-root user
USER nodejs

# Expose API port
EXPOSE 3000

# Configure health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start application
CMD ["npm", "start"]