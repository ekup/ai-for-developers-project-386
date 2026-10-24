# syntax=docker/dockerfile:1

# ---------- Сборка фронтенда ----------
FROM node:22-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---------- Сборка бэкенда ----------
FROM golang:1.27-alpine AS backend
WORKDIR /app/backend
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ ./
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/server ./cmd/server

# ---------- Runtime ----------
FROM alpine:3.22 AS runtime
# tzdata нужна, чтобы переменная TZ (см. docs/adr/0003) действительно
# переключала пояс: без неё time.Local остаётся в UTC.
RUN apk add --no-cache ca-certificates tzdata \
    && addgroup -S app \
    && adduser -S -G app app \
    && mkdir -p /app/data \
    && chown -R app:app /app

WORKDIR /app
COPY --from=backend /out/server /app/server
COPY --from=frontend /app/frontend/dist /app/static

# TZ — пояс записи: рабочие часы и «сегодня» считаются в нём (docs/adr/0003).
# Инвариант образа, а не настройка хоста; переопределяется через -e TZ.
ENV HOST=0.0.0.0 \
    PORT=8080 \
    STATIC_DIR=/app/static \
    DATABASE_PATH=/app/data/app.db \
    TZ=Europe/Moscow

EXPOSE 8080
USER app
ENTRYPOINT ["/app/server"]
