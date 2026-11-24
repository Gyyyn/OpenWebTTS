# Stage 1: Build frontend assets
FROM docker.io/library/node:20-slim AS frontend-builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY templates/ ./templates/
COPY static/ ./static/

RUN npm run build

# Stage 2: Python runtime
FROM docker.io/library/python:3.11-slim-bookworm

# Install system dependencies (including curl for health check, poppler for pdf2image, tesseract for OCR)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    pkg-config \
    ffmpeg \
    espeak-ng \
    curl \
    poppler-utils \
    tesseract-ocr \
    libwebkit2gtk-4.0-37 \
    libgirepository1.0-dev \
    libcairo2-dev \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt \
    && pip install --no-cache-dir https://github.com/KittenML/KittenTTS/releases/download/0.8.1/kittentts-0.8.1-py3-none-any.whl \
    && pip install --no-cache-dir https://github.com/rsxdalv/chatterbox/releases/download/v0.4.4/tts_webui_chatterbox_tts-0.4.4-py3-none-any.whl

# Copy application code
COPY . .

# Copy built frontend assets from frontend-builder
COPY --from=frontend-builder /app/static/css/style.css ./static/css/style.css
COPY --from=frontend-builder /app/static/js/pdf.min.mjs ./static/js/pdf.min.mjs
COPY --from=frontend-builder /app/static/js/pdf.worker.min.mjs ./static/js/pdf.worker.min.mjs
COPY --from=frontend-builder /app/static/js/marked.umd.js ./static/js/marked.umd.js
COPY --from=frontend-builder /app/static/icons ./static/icons

# Create directories for models, users, and audio
RUN mkdir -p models/coqui models/piper models/kokoro static/audio static/audio_cache users

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8000/ || exit 1

# Run the application
CMD ["python", "app.py", "--host", "0.0.0.0", "--port", "8000"]
