FROM docker.io/library/python:3.11-slim-bookworm

# Install system dependencies
RUN apt-get update && apt-get install -y \
  gcc \
  g++ \
  libwebkit2gtk-4.0-37 \
  libgirepository1.0-dev \
  libcairo2-dev \
  ffmpeg \
  pkg-config \
  && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install https://github.com/KittenML/KittenTTS/releases/download/0.1/kittentts-0.1.0-py3-none-any.whl

# Copy application code
COPY . .

# Create directories for models and audio
RUN mkdir -p models/coqui models/piper models/kokoro static/audio static/audio_cache

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8000/ || exit 1

# Run the application
CMD ["python", "app.py", "--host", "0.0.0.0", "--port", "8000"]








