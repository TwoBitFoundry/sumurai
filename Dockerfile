# ---------- Build stage ----------
FROM node:20-alpine AS builder
WORKDIR /app/frontend
COPY frontend/package.json .
COPY frontend/tsconfig.json .
COPY frontend/vite.config.ts .
COPY frontend/tailwind.config.js .
COPY frontend/postcss.config.js .
COPY frontend/index.html .
COPY frontend/src ./src
RUN npm install
RUN npm run build

# ---------- Runtime stage ----------
FROM nginx:1.25-alpine
COPY --from=builder /app/frontend/dist /usr/share/nginx/html
RUN printf 'server { listen 8080; server_name _; root /usr/share/nginx/html; index index.html; location /api/ { proxy_pass http://backend:3000/api/; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; proxy_set_header X-Forwarded-Proto $scheme; } location /health { proxy_pass http://backend:3000/health; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; proxy_set_header X-Forwarded-Proto $scheme; } location / { try_files $uri /index.html; } }' > /etc/nginx/conf.d/default.conf
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
