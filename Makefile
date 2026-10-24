SHELL := /bin/bash

BACKEND_DIR  := backend
FRONTEND_DIR := frontend
API_DIR      := api
E2E_DIR      := e2e
GOBIN        := $(shell go env GOPATH)/bin
STATICCHECK  ?= $(shell command -v staticcheck 2>/dev/null || echo "$(GOBIN)/staticcheck")
# Пояс записи: в нём считаются рабочие часы и окно записи (docs/adr/0003).
TIMEZONE     ?= Europe/Moscow

.DEFAULT_GOAL := help

.PHONY: help
help: ## Показать список команд
	@grep -E '^[a-zA-Z0-9_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

.PHONY: install
install: ## Установить зависимости бэкенда, фронтенда, контракта API и E2E
	cd $(BACKEND_DIR) && go mod download
	cd $(FRONTEND_DIR) && npm ci
	cd $(API_DIR) && npm ci
	cd $(E2E_DIR) && npm ci

.PHONY: test
test: backend-test frontend-test ## Тесты бэкенда и фронтенда (без E2E)

.PHONY: lint
lint: backend-lint frontend-lint ## Запустить все линтеры

.PHONY: backend-test
backend-test: ## Тесты бэкенда
	cd $(BACKEND_DIR) && go test ./...

.PHONY: backend-lint
backend-lint: ## Линтеры бэкенда (go vet + staticcheck)
	cd $(BACKEND_DIR) && go vet ./...
	@test -x "$(STATICCHECK)" || { echo "staticcheck не найден. Установите: go install honnef.co/go/tools/cmd/staticcheck@latest"; exit 1; }
	cd $(BACKEND_DIR) && $(STATICCHECK) ./...

.PHONY: frontend-test
frontend-test: ## Тесты фронтенда
	cd $(FRONTEND_DIR) && npm test

.PHONY: frontend-lint
frontend-lint: ## Линтеры и проверка форматирования фронтенда
	cd $(FRONTEND_DIR) && npm run lint
	cd $(FRONTEND_DIR) && npm run format:check

.PHONY: frontend-build
frontend-build: ## Собрать статику фронтенда
	cd $(FRONTEND_DIR) && npm run build

.PHONY: api-gen
api-gen: ## Сгенерировать OpenAPI, клиентский SDK и Go-артефакты из TypeSpec
	cd $(API_DIR) && npm run compile
	cd $(FRONTEND_DIR) && npx openapi-ts
	cd $(BACKEND_DIR) && go tool oapi-codegen -config oapi-codegen.yaml ../$(API_DIR)/openapi/openapi.yaml

.PHONY: api-check
api-check: api-gen ## Проверить, что сгенерированные артефакты совпадают с контрактом
	@git diff --exit-code -- $(API_DIR)/openapi $(FRONTEND_DIR)/src/api/generated $(BACKEND_DIR)/internal/api || { echo "Сгенерированные артефакты разошлись с контрактом — запустите 'make api-gen' и закоммитьте."; exit 1; }

.PHONY: api-docs
api-docs: api-gen ## Открыть интерактивную документацию API в браузере
	cd $(API_DIR) && node serve-docs.mjs

.PHONY: build
build: frontend-build ## Собрать приложение (фронтенд + бинарник бэкенда)
	cd $(BACKEND_DIR) && go build -o bin/server ./cmd/server

.PHONY: smoke
smoke: ## Дымовой тест: приложение поднимается и отвечает
	./scripts/smoke.sh

.PHONY: e2e
e2e: ## Сквозной браузерный тест полного сценария (Playwright)
	cd $(E2E_DIR) && TZ=$(TIMEZONE) npm test

.PHONY: e2e-install
e2e-install: ## Установить Chromium для E2E-тестов
	cd $(E2E_DIR) && npx playwright install --with-deps chromium

.PHONY: dev-backend
dev-backend: ## Запустить бэкенд локально
	cd $(BACKEND_DIR) && TZ=$(TIMEZONE) STATIC_DIR=../$(FRONTEND_DIR)/dist go run ./cmd/server

.PHONY: dev-frontend
dev-frontend: ## Запустить dev-сервер фронтенда (Vite)
	cd $(FRONTEND_DIR) && npm run dev

.PHONY: docker-build
docker-build: ## Собрать Docker-образ
	docker build -t call-booking:latest .

.PHONY: docker-run
docker-run: ## Запустить контейнер
	docker run --rm -p 8080:8080 -v call-booking-data:/app/data --name call-booking -e TZ=$(TIMEZONE) call-booking:latest

.PHONY: docker-smoke
docker-smoke: ## Дымовой тест Docker-образа (сборка + запуск + /health)
	./scripts/docker-smoke.sh
