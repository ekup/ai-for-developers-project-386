#!/usr/bin/env bash
#
# Сервер для сквозных браузерных тестов: собирает прод-путь (статику фронтенда
# и бинарник бэкенда), поднимает его на временной БД и гасит по завершении.
# Скрипт запускает Playwright через webServer; порт по умолчанию 18081, чтобы
# не пересекаться со smoke.sh на 18080.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="${ROOT_DIR}/backend"
FRONTEND_DIR="${ROOT_DIR}/frontend"
STATIC_DIR="${FRONTEND_DIR}/dist"
BINARY="${BACKEND_DIR}/bin/server"
HOST="127.0.0.1"
PORT="${E2E_PORT:-18081}"

# Пояс записи фиксирован продуктово (docs/adr/0003): от него зависят рабочие
# часы и окно записи, поэтому сервер всегда стартует в нём.
export TZ="${TZ:-Europe/Moscow}"

TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/call-booking-e2e.XXXXXX")"
DB_PATH="${TMP_DIR}/e2e.db"
SERVER_LOG="${TMP_DIR}/server.log"

# cleanup гасит сервер и удаляет временную БД. Приходит и по EXIT, и по
# SIGTERM от Playwright (webServer.gracefulShutdown).
cleanup() {
  status=$?

  if [[ -n "${SERVER_PID:-}" ]] && kill -0 "${SERVER_PID}" 2>/dev/null; then
    kill "${SERVER_PID}" 2>/dev/null || true
    wait "${SERVER_PID}" 2>/dev/null || true
  fi

  if [[ ${status} -ne 0 && -f "${SERVER_LOG}" ]]; then
    echo "==> Сервер завершился с ошибкой. Лог:" >&2
    cat "${SERVER_LOG}" >&2
  fi

  rm -rf "${TMP_DIR}"
}
trap cleanup EXIT
trap 'exit 0' INT TERM

if [[ "${E2E_SKIP_BUILD:-0}" == "1" ]]; then
  echo "==> E2E_SKIP_BUILD=1: использую готовые статику и бинарник"
  if [[ ! -f "${STATIC_DIR}/index.html" ]]; then
    echo "Статика не найдена: ${STATIC_DIR}/index.html. Соберите фронтенд." >&2
    exit 1
  fi
  if [[ ! -x "${BINARY}" ]]; then
    echo "Бинарник не найден: ${BINARY}. Соберите бэкенд." >&2
    exit 1
  fi
else
  echo "==> Собираю фронтенд"
  (cd "${FRONTEND_DIR}" && npm run build)

  echo "==> Собираю бэкенд"
  mkdir -p "$(dirname "${BINARY}")"
  (cd "${BACKEND_DIR}" && go build -o "${BINARY}" ./cmd/server)
fi

echo "==> Запускаю сервер на http://${HOST}:${PORT} (TZ=${TZ}, БД: ${DB_PATH})"
HOST="${HOST}" PORT="${PORT}" STATIC_DIR="${STATIC_DIR}" DATABASE_PATH="${DB_PATH}" \
  "${BINARY}" >"${SERVER_LOG}" 2>&1 &
SERVER_PID=$!

# Playwright сам ждёт /health по webServer.url; здесь только держим процесс на
# переднем плане и пробрасываем его код завершения.
wait "${SERVER_PID}"
