// Package main — точка входа бэкенда сервиса «Запись на звонок».
package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/ekup/ai-for-developers-project-386/backend/internal/config"
	"github.com/ekup/ai-for-developers-project-386/backend/internal/server"
	"github.com/ekup/ai-for-developers-project-386/backend/internal/store"
)

func main() {
	cfg := config.Load()

	db, err := store.Open(cfg.DatabasePath)
	if err != nil {
		log.Fatalf("не удалось открыть БД: %v", err)
	}
	defer func() { _ = db.Close() }()

	srv := &http.Server{
		Addr:              cfg.Addr(),
		Handler:           server.NewRouter(db, cfg.StaticDir),
		ReadHeaderTimeout: 5 * time.Second,
	}

	go func() {
		log.Printf("сервер запущен на %s", cfg.Addr())
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("ошибка сервера: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	log.Println("останавливаю сервер...")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("ошибка остановки сервера: %v", err)
	}

	log.Println("сервер остановлен")
}
