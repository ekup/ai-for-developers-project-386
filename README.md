# Календарь звонков

[![hexlet-check](https://github.com/ekup/ai-for-developers-project-386/actions/workflows/hexlet-check.yml/badge.svg)](https://github.com/ekup/ai-for-developers-project-386/actions)

**Приложение**: https://call-booking-ry23.onrender.com — демо-прод на Render, данные не переживают рестарт (см. раздел [«Прод»](#прод)).

Сервис для бронирования календаря — упрощённый сервис «Запись на звонок».

Учебный проект Хекслета: https://ru.hexlet.io/programs/ai-for-developers
Как это должно работать: https://files.hexlet.app/a/2ipc5m

## Стек

**Бэкенд**

- Go 1.27
- [chi](https://github.com/go-chi/chi) — HTTP-роутер
- SQLite ([modernc.org/sqlite](https://pkg.go.dev/modernc.org/sqlite), чистый Go, без cgo)
- Линтеры: `go vet`, `staticcheck`
- Тесты: `go test`

**Фронтенд**

- TypeScript, [Vite](https://vite.dev/), React
- [Mantine](https://mantine.dev/) — UI-библиотека
- Линтеры: ESLint (`eslint-plugin-react`, `eslint-plugin-react-hooks`), Prettier
- Тесты: [Vitest](https://vitest.dev/) + Testing Library

## Структура

```
.
├── backend/            # Go-сервис (chi + sqlite), отдаёт API и статику фронтенда
│   ├── cmd/server/     # точка входа
│   └── internal/       # config, server, store, api (сгенерированные артефакты)
├── frontend/           # Vite + React + Mantine
│   └── src/            # лендинг, тесты и src/api (клиентский SDK)
├── api/                # контракт API на TypeSpec → OpenAPI (api/openapi/openapi.yaml)
├── scripts/smoke.sh    # дымовой тест: поднять приложение и проверить ответ
├── Dockerfile          # мультистейдж: фронтенд + бэкенд в одном образе
└── Makefile            # команды запуска, тестов и линтеров
```

## Установка

```bash
git clone https://github.com/ekup/ai-for-developers-project-386.git
cd ai-for-developers-project-386

# зависимости фронтенда и бэкенда
make install

# линтер для Go
go install honnef.co/go/tools/cmd/staticcheck@latest
```

## Запуск локально

Бэкенд и фронтенд запускаются раздельно. Бэкенд слушает `:8080`, Vite — `:5173` и
проксирует `/api` на бэкенд.

```bash
# терминал 1 — бэкенд
make dev-backend

# терминал 2 — фронтенд (http://localhost:5173)
make dev-frontend
```

Проверка бэкенда:

```bash
curl http://localhost:8080/health
# {"status":"ok"}
```

## Тесты и линтеры

```bash
make test           # тесты бэкенда и фронтенда
make lint           # go vet + staticcheck, ESLint + Prettier

make backend-test   # только тесты бэкенда
make backend-lint   # только линтеры бэкенда
make frontend-test  # только тесты фронтенда
make frontend-lint  # только линтеры фронтенда

make smoke          # дымовой тест: приложение поднимается и отвечает
```

## API-контракт

Контракт API описан на [TypeSpec](https://typespec.io/) в `api/` и служит единственным источником истины для запросов и ответов. Из него генерируются OpenAPI-спецификация, клиентский SDK фронтенда и серверные артефакты Go.

```bash
make api-gen        # TypeSpec → api/openapi/openapi.yaml → SDK + Go-артефакты
make api-check      # то же самое + проверка, что артефакты не разошлись с контрактом
make api-docs       # открыть интерактивную документацию API (Swagger UI) в браузере
```

Что получается на выходе:

- `api/openapi/openapi.yaml` — OpenAPI-спецификация (эмиттер `@typespec/openapi3`);
- `frontend/src/api/generated/` — типизированный SDK (`@hey-api/openapi-ts`), поверх него — обёртка `frontend/src/api/client.ts`;
- `backend/internal/api/api.gen.go` — модели, валидация запросов и интерфейс маршрутов chi (`oapi-codegen`).

Сгенерированные файлы коммитятся, поэтому сборка не требует запуска генерации. Если правишь контракт — запусти `make api-gen` и закоммить результат: CI-задача `api` падает, если артефакты разошлись с `api/*.tsp`.

## Docker

Приложение собирается в один образ: бэкенд раздаёт собранную статику фронтенда.

```bash
make docker-build
make docker-run     # http://localhost:8080
make docker-smoke   # собрать образ, поднять контейнер и проверить /health
```

Или напрямую:

```bash
docker build -t call-booking:latest .
docker run --rm -p 8080:8080 -v call-booking-data:/app/data call-booking:latest
```

### Переменные окружения

| Переменная      | По умолчанию  | Назначение                          |
| --------------- | ------------- | ----------------------------------- |
| `HOST`          | `0.0.0.0`     | адрес HTTP-сервера                  |
| `PORT`          | `8080`        | порт HTTP-сервера                   |
| `DATABASE_PATH` | `data/app.db` | путь к файлу SQLite                 |
| `STATIC_DIR`    | `static`      | каталог со собранной статикой фронта |
| `TZ`            | пояс хоста    | пояс записи: рабочие часы и окно записи считаются в нём. В проде и dev — `Europe/Moscow` (см. `docs/adr/0003`) |

## Прод

Прод живёт на [Render](https://render.com/) по блюпринту `render.yaml`: один web-сервис `call-booking-ekup` в регионе Frankfurt, который собирается из корневого `Dockerfile` и обновляется по пушам в `main` — но только после зелёных проверок ветки.

- приложение: https://call-booking-ry23.onrender.com
- здоровье: https://call-booking-ry23.onrender.com/health

Compute-план — `free`, поэтому это **демо-прод**:

- файловая система эфемерная: база `app.db` стирается при каждом редеплое, рестарте и спин-дауне. Созданные типы событий и записи гостей не переживают даже 15 минут без трафика; схема и seed-типы пересоздаются при старте;
- после спин-дауна первый запрос ждёт около минуты, пока сервис поднимается.

Авторизации в сервисе нет (см. `docs/spec.md`, раздел 9), поэтому владельческие страницы закрыты от индексации в `frontend/public/robots.txt`, но остаются доступными по прямой ссылке.

Применение блюпринта: в Render Dashboard — **New → Blueprint**, выбрать этот репозиторий и ветку `main`. Дальше сервис обновляется сам.

## CI

GitHub Actions (`.github/workflows/ci.yml`) на каждый push и pull request:

- бэкенд: `go vet`, `staticcheck`, `go test`;
- фронтенд: ESLint, Prettier, Vitest;
- дымовой тест: приложение собирается, поднимается и отвечает на `/health`;
- Docker: образ собирается, контейнер стартует и слушает порт из `PORT`.

---

<details>
<summary>Автоматические тесты Хекслета</summary>

Тесты запускаются на каждый коммит. За запуск отвечает файл `.github/workflows/hexlet-check.yml` — не удаляйте и не переименовывайте ни его, ни репозиторий.

</details>

## О Хекслете

[Хекслет](https://ru.hexlet.io/) — школа программирования: авторские программы обучения с практикой, поддержкой наставников и реальными проектами, которые остаются в резюме. Этот репозиторий — один из таких проектов.
