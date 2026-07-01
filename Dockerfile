# Stage 1: Build the React frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Run the FastAPI backend & serve static files
FROM python:3.11-slim AS runner
WORKDIR /app

# Install system compilation tools for DuckDB / other binaries
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source scripts and modules
COPY main.py .
COPY semantic_store.py .
COPY agents/ ./agents/

# Copy built frontend static files from node builder stage
COPY --from=frontend-builder /app/dist ./dist

# Expose production port
EXPOSE 8000

# Start server using uvicorn
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
