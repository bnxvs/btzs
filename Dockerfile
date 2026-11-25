# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Сборка веб-бандла (Vite) стадии 1.
# ---------------------------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app

# Сначала зависимости — слой кешируется, пока не менялись манифесты.
COPY package.json package-lock.json ./
RUN npm ci

# Затем исходники. .dockerignore исключает node_modules, dist, app/, RE-артефакты.
COPY . .
RUN npm run build

# ---------------------------------------------------------------------------
# Раздача статики через nginx — стадия 2 (финальный образ).
# ---------------------------------------------------------------------------
FROM nginx:1.27-alpine AS runtime

ARG APP_VERSION="1.2.0"

LABEL org.opencontainers.image.title="Plotter" \
      org.opencontainers.image.description="Plotter for macOS — веб-порт Plotter for Windows (BTZS Software)" \
      org.opencontainers.image.version="${APP_VERSION}" \
      org.opencontainers.image.source="https://github.com/bnxvs/btzs" \
      org.opencontainers.image.licenses="Proprietary"

# Конфигурация сервера (SPA-fallback, кеш, gzip, /healthz).
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Собранная статика.
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/healthz >/dev/null 2>&1 || exit 1

# Базовый образ nginx уже запускает nginx на переднем плане.
