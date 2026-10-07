// Package server собирает HTTP-роутер приложения.
package server

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

// NewRouter создаёт HTTP-роутер приложения.
//
// db может быть nil — тогда проверка базы в /health пропускается.
// staticDir — каталог со собранной статикой фронтенда; если пустой,
// статика не раздаётся (режим разработки и тесты).
func NewRouter(db *sql.DB, staticDir string) http.Handler {
	r := chi.NewRouter()

	r.Use(middleware.RequestID)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	r.Get("/health", healthHandler(db))

	if staticDir != "" {
		r.Handle("/*", spaHandler(staticDir))
	}

	return r
}

// healthHandler отдаёт состояние сервиса в формате JSON.
func healthHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		resp := map[string]string{"status": "ok"}

		if db != nil {
			if err := db.PingContext(r.Context()); err != nil {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusServiceUnavailable)
				_ = json.NewEncoder(w).Encode(map[string]string{
					"status": "error",
					"reason": "database unavailable",
				})
				return
			}
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(resp)
	}
}

// spaHandler раздаёт статические файлы и отдаёт index.html для
// клиентских маршрутов (SPA fallback).
func spaHandler(staticDir string) http.Handler {
	fileServer := http.FileServer(http.Dir(staticDir))

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cleanPath := path.Clean(r.URL.Path)

		if cleanPath == "/" || cleanPath == "." {
			fileServer.ServeHTTP(w, r)
			return
		}

		fullPath := filepath.Join(staticDir, filepath.FromSlash(strings.TrimPrefix(cleanPath, "/")))
		if info, err := os.Stat(fullPath); err == nil && !info.IsDir() {
			fileServer.ServeHTTP(w, r)
			return
		}

		http.ServeFile(w, r, filepath.Join(staticDir, "index.html"))
	})
}
