# Календарь звонков

[![hexlet-check](https://github.com/ekup/ai-for-developers-project-386/actions/workflows/hexlet-check.yml/badge.svg)](https://github.com/ekup/ai-for-developers-project-386/actions)

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
│   └── internal/       # config, server, store
├── frontend/           # Vite + React + Mantine
│   └── src/            # лендинг и тесты
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

## Docker

Приложение собирается в один образ: бэкенд раздаёт собранную статику фронтенда.

```bash
make docker-build
make docker-run     # http://localhost:8080
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

## CI

GitHub Actions (`.github/workflows/ci.yml`) на каждый push и pull request:

- бэкенд: `go vet`, `staticcheck`, `go test`;
- фронтенд: ESLint, Prettier, Vitest;
- дымовой тест: приложение собирается, поднимается и отвечает на `/health`.

---

<details>
<summary>Автоматические тесты Хекслета</summary>

Тесты запускаются на каждый коммит. За запуск отвечает файл `.github/workflows/hexlet-check.yml` — не удаляйте и не переименовывайте ни его, ни репозиторий.

</details>

## О Хекслете

[Хекслет](https://ru.hexlet.io/) — школа программирования: авторские программы обучения с практикой, поддержкой наставников и реальными проектами, которые остаются в резюме. Этот репозиторий — один из таких проектов.
