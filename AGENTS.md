# AGENTS.md

Учебный проект Хекслета «Запись на звонок»: сервис бронирования календаря.

## Структура

- `backend/` — Go (chi + SQLite). Модуль `github.com/ekup/ai-for-developers-project-386/backend`.
  - `cmd/server/` — точка входа; `internal/{config,server,store}` — единственные пакеты.
- `frontend/` — Vite + React + Mantine (TypeScript).
- Бэкенд отдаёт API и (в проде/Docker) собранную статику фронтенда. `STATIC_DIR` пустой → статика не раздаётся.
- Корневой `Makefile` — источник истины по командам (`make help`).

## Команды

Все команды — из корня репозитория, кроме отмеченных.

- `make install` — зависимости бэкенда, фронтенда, контракта API и `e2e/` (`go mod download` + `npm ci`).
- `make test` — бэкенд (`go test ./...`) + фронтенд (`npm test` = `vitest run`).
- `make lint` — бэкенд (`go vet` + `staticcheck`) + фронтенд (ESLint + `prettier --check`).
- `make smoke` — `./scripts/smoke.sh`: собирает оба проекта, поднимает сервер на порту `18080` с временной БД, проверяет `/health` и отдачу лендинга.
- `make e2e` — сквозной браузерный тест Playwright против реального сервера: собирает фронтенд и бинарник, поднимает их на порту `18081` с временной БД. `E2E_SKIP_BUILD=1` — пропустить сборку для быстрых локальных итераций. В `make test` не входит.
- `make e2e-install` — поставить Chromium и системные зависимости для E2E (нужно один раз после `make install`).
- `make build` — сначала `frontend-build`, потом бинарник в `backend/bin/server` (gitignored).
- `make dev-backend` / `make dev-frontend` — бэкенд `:8080`, Vite `:5173` с прокси `/api` → `http://localhost:8080`.

Точечные запуски:

- Один тест бэкенда: `cd backend && go test ./internal/server -run TestHealthSmoke`
- Один тест фронтенда: `cd frontend && npx vitest run src/App.test.tsx`
- Типы фронтенда: `cd frontend && npm run typecheck` (также входит в `npm run build` как `tsc -b`).

## Требования и готчи

- `staticcheck` не ставится через `make install`. Нужен в `PATH`: `go install honnef.co/go/tools/cmd/staticcheck@latest`. CI пинит версию `v0.8.2` — для воспроизведения CI ставьте её же.
- `make dev-backend` подставляет `STATIC_DIR=../frontend/dist`, который существует только после сборки фронтенда. В dev это ок: UI отдаёт Vite, `/api` проксируется на бэкенд.
- Конфиг из окружения: `HOST` (0.0.0.0), `PORT` (8080), `DATABASE_PATH` (`data/app.db`, каталог создаётся автоматически), `STATIC_DIR` (`static`).
- SQLite — `modernc.org/sqlite` (чистый Go, без cgo), сборка с `CGO_ENABLED=0`. Соединение ограничено `MaxOpenConns(1)`.
- `.github/workflows/hexlet-check.yml` автогенерируется: **не удалять/не редактировать**, репозиторий не переименовывать — иначе автотесты Хекслета сломаются. Также не трогать `.github/workflows/README.md`.

## Релизы

- `.github/workflows/release-please.yml` — release-please читает Conventional Commits, обновляет `CHANGELOG.md` и версии, держит release-PR; после мержа PR создаёт теги и GitHub Releases.
- Конфиг — `release-please-config.json`, текущие версии — `.release-please-manifest.json`. Релизы раздельные: бэкенд `backend/vX.Y.Z`, фронтенд `frontend-vX.Y.Z`.
- Версии растут по SemVer: `feat` → minor, `fix` → patch, `!`/`BREAKING CHANGE` → minor (пока `0.x` из-за `bump-minor-pre-major`).

## Конвенции

- Комментарии, документация и UI-текст — на русском; идентификаторы в коде — на английском.
- Сообщения коммитов — строго по [Conventional Commits](https://www.conventionalcommits.org/): `<type>[optional scope]: <description>`, где `type` — один из `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`. Пример: `feat: каркас приложения`. Описание — на русском, в императиве, без заглавной буквы в начале и без точки в конце. Ломающие изменения помечать `!` и/или `BREAKING CHANGE:` в теле.
- Коммиты реализации тикета должны ссылаться на его номер: в теле коммита указывай `Refs #<номер>`, а для коммита, который закрывает тикет, — `Closes #<номер>` (в футере, отдельной строкой). Пример заголовка и футера: `feat: добавить выбор слота` / `Closes #12`.
- Тесты лежат рядом с кодом: `*_test.go`, `*.test.tsx`.
- TS строгий, с `noUnusedLocals`/`noUnusedParameters` — неиспользуемые переменные валят сборку.

## Agent skills

### Issue tracker

Issues live in this repo's GitHub Issues (via the `gh` CLI). See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles map 1:1 to their label strings. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
