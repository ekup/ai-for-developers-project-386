#!/usr/bin/env bash
#
# Дымовой тест Docker-образа: собирает образ, поднимает контейнер и проверяет,
# что приложение стартует само и слушает порт из переменной окружения PORT.
# Порт намеренно отличается от дефолтного, чтобы проверка ловила привязку к 8080.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE="${IMAGE:-call-booking:smoke}"
CONTAINER="${CONTAINER:-call-booking-smoke}"
PORT="${PORT:-18080}"

cleanup() {
  docker rm -f "${CONTAINER}" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "==> Собираю образ ${IMAGE}"
docker build -t "${IMAGE}" "${ROOT_DIR}"

# Подчистить контейнер-тёзку от предыдущего неудачного прогона.
cleanup

echo "==> Запускаю контейнер на порту ${PORT}"
docker run -d --name "${CONTAINER}" -e PORT="${PORT}" -p "${PORT}:${PORT}" "${IMAGE}" >/dev/null

echo "==> Жду готовности /health"
ready="false"
for _ in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:${PORT}/health" >/dev/null 2>&1; then
    ready="true"
    break
  fi
  if ! docker ps --format '{{.Names}}' | grep -qx "${CONTAINER}"; then
    echo "Контейнер завершился до готовности. Логи:" >&2
    docker logs "${CONTAINER}" >&2 || true
    exit 1
  fi
  sleep 0.5
done

if [[ "${ready}" != "true" ]]; then
  echo "Приложение не ответило на /health за отведённое время. Логи:" >&2
  docker logs "${CONTAINER}" >&2 || true
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

echo "✅ Docker-дымовой тест пройден: контейнер стартует и слушает PORT=${PORT}"
