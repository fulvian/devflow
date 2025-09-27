# DevFlow Coordinator - Production Dockerfile
# Generated from DEVFLOW-PROD-DEPLOY-001 analysis by DeepSeek V3

FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json pnpm-lock.yaml ./
COPY packages/core/package.json ./packages/core/
COPY packages/shared/package.json ./packages/shared/
COPY packages/adapters/*/package.json ./packages/adapters/

# Install dependencies
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN pnpm run build

# Production stage
FROM node:18-alpine AS production

# Create app user
RUN addgroup -g 1001 -S devflow && \
    adduser -S devflow -u 1001

# Set working directory
WORKDIR /app

# Copy built application
COPY --from=builder --chown=devflow:devflow /app/packages/core/dist ./dist
COPY --from=builder --chown=devflow:devflow /app/node_modules ./node_modules
COPY --from=builder --chown=devflow:devflow /app/package.json ./

# Create directories
RUN mkdir -p /var/lib/sqlite /var/log/devflow && \
    chown -R devflow:devflow /var/lib/sqlite /var/log/devflow

# Install curl for health checks
RUN apk add --no-cache curl

# Switch to non-root user
USER devflow

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "dist/index.js"]