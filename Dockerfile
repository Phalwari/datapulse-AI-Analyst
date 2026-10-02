# Stage 1: Build the React frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Run the FastAPI backend & serve static files
FROM python:3.11-slim AS runner
WORKDIR /app/backend

# Install system compilation tools for DuckDB / native binaries
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source code
COPY backend/ ./

# Copy built frontend static files from node builder stage
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist
COPY --from=frontend-builder /app/frontend/dist ./dist

# Expose production port
EXPOSE 8000

# Start server using uvicorn
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

