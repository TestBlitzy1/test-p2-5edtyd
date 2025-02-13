# Stage 1: Builder stage
FROM python:3.11-slim AS builder

# Version comments for base images
# python:3.11-slim - Official Python slim image
# pytorch/pytorch:2.0.0-cuda11.7-cudnn8-runtime - Official PyTorch image with CUDA support

# Set build arguments and environment variables
ARG DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install system dependencies and security updates
RUN apt-get update && apt-get upgrade -y \
    && apt-get install -y --no-install-recommends \
        build-essential \
        curl \
        git \
        libpq-dev \
        pkg-config \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -r ai-service && useradd -r -g ai-service ai-service

# Create and set working directory
WORKDIR /build

# Copy requirements file
COPY --chown=ai-service:ai-service requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir --upgrade pip setuptools wheel \
    && pip install --no-cache-dir -r requirements.txt

# Stage 2: Production stage
FROM pytorch/pytorch:2.0.0-cuda11.7-cudnn8-runtime

# Set production environment variables
ENV PYTHONPATH=/app \
    PYTORCH_MODEL_PATH=/app/models \
    PORT=8000 \
    NVIDIA_VISIBLE_DEVICES=all \
    NVIDIA_DRIVER_CAPABILITIES=compute,utility \
    LOG_LEVEL=INFO \
    MAX_WORKERS=4 \
    TIMEOUT=120

# Install system dependencies
RUN apt-get update && apt-get upgrade -y \
    && apt-get install -y --no-install-recommends \
        curl \
        libpq5 \
        tini \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user and directories
RUN groupadd -r ai-service && useradd -r -g ai-service ai-service \
    && mkdir -p /app/models /app/logs /app/cache \
    && chown -R ai-service:ai-service /app

# Set working directory
WORKDIR /app

# Copy Python packages from builder
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages

# Copy application code
COPY --chown=ai-service:ai-service src/ /app/
COPY --chown=ai-service:ai-service models/ /app/models/

# Set permissions
RUN chmod -R 755 /app \
    && chmod 644 /app/models/* \
    && chown -R ai-service:ai-service /app/logs /app/cache

# Switch to non-root user
USER ai-service

# Health check configuration
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl --fail http://localhost:8000/health || exit 1

# Resource limits
ENV NVIDIA_VISIBLE_DEVICES=all \
    NVIDIA_DRIVER_CAPABILITIES=compute,utility

# Configure logging
LABEL maintainer="AI Service Team" \
      version="1.0.0" \
      description="AI Service for campaign generation and optimization"

# Set up Gunicorn configuration
ENV GUNICORN_CMD_ARGS="--workers=${MAX_WORKERS} \
    --timeout=${TIMEOUT} \
    --bind=0.0.0.0:${PORT} \
    --worker-class=uvicorn.workers.UvicornWorker \
    --log-level=${LOG_LEVEL} \
    --access-logfile=- \
    --error-logfile=- \
    --capture-output \
    --enable-stdio-inheritance"

# Use tini as init process
ENTRYPOINT ["/usr/bin/tini", "--"]

# Start the application with Gunicorn
CMD ["gunicorn", "app:app"]

# Expose port
EXPOSE ${PORT}