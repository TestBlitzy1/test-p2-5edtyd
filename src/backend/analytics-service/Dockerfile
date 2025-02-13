# Build stage
FROM python:3.11-slim AS builder

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Set working directory
WORKDIR /usr/src/app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN python -m venv /usr/src/app/venv && \
    . /usr/src/app/venv/bin/activate && \
    pip install --no-cache-dir -r requirements.txt && \
    pip install safety

# Copy source code
COPY . .

# Run tests and security checks
RUN . /usr/src/app/venv/bin/activate && \
    python -m pytest tests/ && \
    safety check && \
    python -m pylint src/

# Clean up build artifacts
RUN apt-get purge -y --auto-remove build-essential && \
    rm -rf /var/lib/apt/lists/*

# Production stage
FROM python:3.11-slim

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/usr/src/app/venv/bin:$PATH" \
    PORT=3002

# Set working directory
WORKDIR /usr/src/app

# Create non-root user
RUN groupadd -g 1001 analytics && \
    useradd -u 1001 -g analytics -s /bin/bash -m analytics && \
    apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*

# Copy artifacts from builder
COPY --from=builder --chown=analytics:analytics /usr/src/app/venv ./venv
COPY --from=builder --chown=analytics:analytics /usr/src/app/src ./src
COPY --from=builder --chown=analytics:analytics /usr/src/app/requirements.txt .

# Set permissions
RUN chmod -R 755 /usr/src/app

# Switch to non-root user
USER analytics

# Expose port
EXPOSE 3002

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3002/health || exit 1

# Set entry point
ENTRYPOINT ["python", "-m", "src.main"]