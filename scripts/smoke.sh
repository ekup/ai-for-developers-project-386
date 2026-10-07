#!/usr/bin/env bash
#
# Дымовой тест: собирает бэкенд, поднимает приложение в реальном процессе,
# проверяет /health и отдачу лендинга. Используется в CI и локально.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="${ROOT_DIR}/backend"
FRONTEND_DIR="${ROOT_DIR}/frontend"
STATIC_DIR="${ROOT_DIR}/frontend/dist"
BINARY="${ROOT_DIR}/backend/bin/server"
PORT="${PORT:-18080}"

TMP_DIR="$(mktemp -d)"
DB_PATH="${TMP_DIR}/smoke.db"

cleanup() {
  if [[ -n "${SERVER_PID:-}" ]]; then
    kill "${SERVER_PID}" 2>/dev/null || true
    wait "${SERVER_PID}" 2>/dev/null || true
  fi
  rm -rf "${TMP_DIR}"
}
trap cleanup EXIT

if [[ ! -f "${STATIC_DIR}/index.html" ]]; then
  echo "==> Статика не найдена, собираю фронтенд"
  (cd "${FRONTEND_DIR}" && npm run build)
fi

echo "==> Собираю бэкенд"
(cd "${BACKEND_DIR}" && go build -o "${BINARY}" ./cmd/server)

echo "==> Запускаю сервер на порту ${PORT}"
HOST=127.0.0.1 PORT="${PORT}" STATIC_DIR="${STATIC_DIR}" DATABASE_PATH="${DB_PATH}" \
  "${BINARY}" >"${TMP_DIR}/server.log" 2>&1 &
SERVER_PID=$!

echo "==> Жду готовности /health"
ready="false"
for _ in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:${PORT}/health" >/dev/null 2>&1; then
    ready="true"
    break
  fi
  if ! kill -0 "${SERVER_PID}" 2>/dev/null; then
    echo "Сервер завершился до готовности. Лог:" >&2
    cat "${TMP_DIR}/server.log" >&2
    exit 1
  fi
  sleep 0.5
done

if [[ "${ready}" != "true" ]]; then
  echo "Сервер не ответил на /health за отведённое время. Лог:" >&2
  cat "${TMP_DIR}/server.log" >&2
  exit 1
fi

HEALTH_BODY="$(curl -fsS "http://127.0.0.1:${PORT}/health")"
echo "GET /health -> ${HEALTH_BODY}"
if [[ "${HEALTH_BODY}" != *'"status":"ok"'* ]]; then
  echo "Неожиданный ответ /health: ${HEALTH_BODY}" >&2
  exit 1
fi

if ! curl -fsS "http://127.0.0.1:${PORT}/" | grep -qi "Запись на звонок"; then
  echo "Лендинг не отдаётся" >&2
  exit 1
fi

echo "✅ Дымовой тест пройден: приложение поднялось и отвечает"
