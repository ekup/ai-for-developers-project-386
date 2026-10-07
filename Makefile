SHELL := /bin/bash

BACKEND_DIR  := backend
FRONTEND_DIR := frontend
GOBIN        := $(shell go env GOPATH)/bin
STATICCHECK  ?= $(shell command -v staticcheck 2>/dev/null || echo "$(GOBIN)/staticcheck")

.DEFAULT_GOAL := help

.PHONY: help
help: ## Показать список команд
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

.PHONY: install
install: ## Установить зависимости бэкенда и фронтенда
	cd $(BACKEND_DIR) && go mod download
	cd $(FRONTEND_DIR) && npm ci

.PHONY: test
test: backend-test frontend-test ## Запустить все тесты

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

.PHONY: build
build: frontend-build ## Собрать приложение (фронтенд + бинарник бэкенда)
	cd $(BACKEND_DIR) && go build -o bin/server ./cmd/server

.PHONY: smoke
smoke: ## Дымовой тест: приложение поднимается и отвечает
	./scripts/smoke.sh

.PHONY: dev-backend
dev-backend: ## Запустить бэкенд локально
	cd $(BACKEND_DIR) && STATIC_DIR=../$(FRONTEND_DIR)/dist go run ./cmd/server

.PHONY: dev-frontend
dev-frontend: ## Запустить dev-сервер фронтенда (Vite)
	cd $(FRONTEND_DIR) && npm run dev

.PHONY: docker-build
docker-build: ## Собрать Docker-образ
	docker build -t call-booking:latest .

.PHONY: docker-run
docker-run: ## Запустить контейнер
	docker run --rm -p 8080:8080 -v call-booking-data:/app/data --name call-booking call-booking:latest
