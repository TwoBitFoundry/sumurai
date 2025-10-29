# ---------- Build stage ----------
FROM node:20-alpine AS builder
WORKDIR /app/frontend

ARG VITE_OTEL_ENABLED=true
ARG VITE_OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:8080/ingest/otlp
ARG SEQ_API_KEY=""
ARG VITE_OTEL_SERVICE_NAME=sumaura-frontend
ARG VITE_OTEL_SERVICE_VERSION=1.0.0
ARG VITE_OTEL_SANITIZE_HEADERS=true
ARG VITE_OTEL_SANITIZE_URLS=true
ARG VITE_OTEL_CAPTURE_BODIES=false
ARG VITE_OTEL_BLOCK_SENSITIVE_ENDPOINTS=true

ENV VITE_OTEL_ENABLED=${VITE_OTEL_ENABLED}
ENV VITE_OTEL_EXPORTER_OTLP_ENDPOINT=${VITE_OTEL_EXPORTER_OTLP_ENDPOINT}
ENV VITE_OTEL_SEQ_API_KEY=${SEQ_API_KEY}
ENV VITE_OTEL_SERVICE_NAME=${VITE_OTEL_SERVICE_NAME}
ENV VITE_OTEL_SERVICE_VERSION=${VITE_OTEL_SERVICE_VERSION}
ENV VITE_OTEL_SANITIZE_HEADERS=${VITE_OTEL_SANITIZE_HEADERS}
ENV VITE_OTEL_SANITIZE_URLS=${VITE_OTEL_SANITIZE_URLS}
ENV VITE_OTEL_CAPTURE_BODIES=${VITE_OTEL_CAPTURE_BODIES}
ENV VITE_OTEL_BLOCK_SENSITIVE_ENDPOINTS=${VITE_OTEL_BLOCK_SENSITIVE_ENDPOINTS}

# Copy dependency manifests first to leverage Docker layer caching
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

# Copy configuration and source files for the build
COPY frontend/tsconfig.json .
COPY frontend/vite.config.ts .
COPY frontend/tailwind.config.js .
COPY frontend/postcss.config.js .
COPY frontend/index.html .
COPY frontend/src ./src
COPY docs /app/docs
RUN npm run build

# ---------- Runtime stage ----------
FROM nginx:1.25-alpine
COPY --from=builder /app/frontend/dist /usr/share/nginx/html
RUN printf 'server { listen 8080; server_name _; root /usr/share/nginx/html; index index.html; location /api/ { proxy_pass http://backend:3000/api/; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; proxy_set_header X-Forwarded-Proto $scheme; } location /health { proxy_pass http://backend:3000/health; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; proxy_set_header X-Forwarded-Proto $scheme; } location /ingest/otlp/ { proxy_pass http://seq:80/ingest/otlp/; proxy_http_version 1.1; proxy_set_header Host seq; client_body_buffer_size 1m; } location / { try_files $uri /index.html; } }' > /etc/nginx/conf.d/default.conf
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
