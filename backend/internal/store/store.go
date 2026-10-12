// Package store отвечает за подключение к базе данных SQLite.
package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	_ "modernc.org/sqlite" // чистый Go драйвер SQLite
)

// Open открывает подключение к SQLite и проверяет его доступность.
//
// Соединение ограничено одним активным подключением, а транзакции начинаются с
// BEGIN IMMEDIATE: проверка занятости и вставка записи не пересекаются с
// одновременными запросами (см. docs/adr/0002).
func Open(dsn string) (*sql.DB, error) {
	if dsn == "" {
		return nil, errors.New("store: пустой DSN")
	}

	if dir := filepath.Dir(dsn); dir != "." && dir != "" {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			return nil, fmt.Errorf("store: создать каталог для БД: %w", err)
		}
	}

	db, err := sql.Open("sqlite", withTxLock(dsn))
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

// withTxLock добавляет к DSN параметр `_txlock=immediate`, чтобы транзакции
// начинались с блокировки записи. Путь к файлу БД при этом не меняется:
// драйвер отделяет query-параметры от имени файла.
func withTxLock(dsn string) string {
	separator := "?"
	if strings.Contains(dsn, "?") {
		separator = "&"
	}

	return dsn + separator + "_txlock=immediate"
}
