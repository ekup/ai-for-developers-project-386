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
RUN apk add --no-cache ca-certificates \
    && addgroup -S app \
    && adduser -S -G app app \
    && mkdir -p /app/data \
    && chown -R app:app /app

WORKDIR /app
COPY --from=backend /out/server /app/server
COPY --from=frontend /app/frontend/dist /app/static

ENV HOST=0.0.0.0 \
    PORT=8080 \
    STATIC_DIR=/app/static \
    DATABASE_PATH=/app/data/app.db

EXPOSE 8080
USER app
ENTRYPOINT ["/app/server"]
