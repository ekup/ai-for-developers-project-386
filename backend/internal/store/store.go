// Package store отвечает за подключение к базе данных SQLite.
package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"time"

	_ "modernc.org/sqlite" // чистый Go драйвер SQLite
)

// Open открывает подключение к SQLite и проверяет его доступность.
func Open(dsn string) (*sql.DB, error) {
	if dsn == "" {
		return nil, errors.New("store: пустой DSN")
	}

	if dir := filepath.Dir(dsn); dir != "." && dir != "" {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			return nil, fmt.Errorf("store: создать каталог для БД: %w", err)
		}
	}

	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("store: открыть БД: %w", err)
	}

	db.SetMaxOpenConns(1)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := db.PingContext(ctx); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("store: ping БД: %w", err)
	}

	return db, nil
}
