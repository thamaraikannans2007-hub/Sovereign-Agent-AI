# Multi-stage / clean Python 3.11 slim image for Sovereign Air-Gapped Environment
FROM python:3.11-slim

# Prevent Python from writing .pyc and buffer stdout/stderr
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY requirements.txt /app/
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy backend application source
COPY . /app/

# Create non-root user for security compliance
RUN useradd -m -u 1000 sovereign && \
    mkdir -p /app/media /app/staticfiles && \
    chown -R sovereign:sovereign /app

USER sovereign

EXPOSE 8000

CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
