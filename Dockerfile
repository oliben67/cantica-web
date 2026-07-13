# syntax=docker/dockerfile:1

# ── Stage 1: build ─────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── Stage 2: runtime ───────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runtime

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Nginx site config: serve SPA + proxy API requests to the api service
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 \
    CMD wget -qO- http://127.0.0.1/health || exit 1
