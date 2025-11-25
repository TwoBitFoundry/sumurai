# ---------- Build stage ----------
FROM node:20-alpine AS builder
WORKDIR /app/frontend-next

ARG NEXT_PUBLIC_OTEL_ENABLED=true
ARG NEXT_PUBLIC_OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:8080/ingest/otlp
ARG NEXT_PUBLIC_OTEL_SEQ_API_KEY=""
ARG NEXT_PUBLIC_OTEL_SERVICE_NAME=sumaura-frontend
ARG NEXT_PUBLIC_OTEL_SERVICE_VERSION=1.0.0
ARG NEXT_PUBLIC_OTEL_SANITIZE_HEADERS=true
ARG NEXT_PUBLIC_OTEL_SANITIZE_URLS=true
ARG NEXT_PUBLIC_OTEL_CAPTURE_BODIES=false
ARG NEXT_PUBLIC_OTEL_BLOCK_SENSITIVE_ENDPOINTS=true

ENV NEXT_PUBLIC_OTEL_ENABLED=${NEXT_PUBLIC_OTEL_ENABLED}
ENV NEXT_PUBLIC_OTEL_EXPORTER_OTLP_ENDPOINT=${NEXT_PUBLIC_OTEL_EXPORTER_OTLP_ENDPOINT}
ENV NEXT_PUBLIC_OTEL_SEQ_API_KEY=${NEXT_PUBLIC_OTEL_SEQ_API_KEY}
ENV NEXT_PUBLIC_OTEL_SERVICE_NAME=${NEXT_PUBLIC_OTEL_SERVICE_NAME}
ENV NEXT_PUBLIC_OTEL_SERVICE_VERSION=${NEXT_PUBLIC_OTEL_SERVICE_VERSION}
ENV NEXT_PUBLIC_OTEL_SANITIZE_HEADERS=${NEXT_PUBLIC_OTEL_SANITIZE_HEADERS}
ENV NEXT_PUBLIC_OTEL_SANITIZE_URLS=${NEXT_PUBLIC_OTEL_SANITIZE_URLS}
ENV NEXT_PUBLIC_OTEL_CAPTURE_BODIES=${NEXT_PUBLIC_OTEL_CAPTURE_BODIES}
ENV NEXT_PUBLIC_OTEL_BLOCK_SENSITIVE_ENDPOINTS=${NEXT_PUBLIC_OTEL_BLOCK_SENSITIVE_ENDPOINTS}

# Copy dependency manifests first to leverage Docker layer caching
COPY frontend-next/package.json frontend-next/package-lock.json ./
RUN npm ci

# Copy configuration and source files for the build
COPY frontend-next/tsconfig.json .
COPY frontend-next/next.config.js .
COPY frontend-next/tailwind.config.js .
COPY frontend-next/postcss.config.js .
COPY frontend-next/src ./src
COPY frontend-next/public ./public
COPY docs /app/docs
RUN npm run build

# ---------- Runtime stage ----------
FROM nginx:1.25-alpine
COPY --from=builder /app/frontend-next/out /usr/share/nginx/html
RUN printf 'server { listen 8080; server_name _; root /usr/share/nginx/html; index index.html/; location /api/ { proxy_pass http://backend:3000/api/; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; proxy_set_header X-Forwarded-Proto $scheme; } location /health { proxy_pass http://backend:3000/health; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; proxy_set_header X-Forwarded-Proto $scheme; } location /ingest/otlp/ { proxy_pass http://seq:80/ingest/otlp/; proxy_http_version 1.1; proxy_set_header Host seq; client_body_buffer_size 1m; } location ~ ^/[^.]*$ { try_files $uri /index.html/; } }' > /etc/nginx/conf.d/default.conf
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
