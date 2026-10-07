package store

import (
	"path/filepath"
	"testing"
)

func TestOpenCreatesDatabase(t *testing.T) {
	dsn := filepath.Join(t.TempDir(), "nested", "app.db")

	db, err := Open(dsn)
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	defer func() { _ = db.Close() }()

	if err := db.Ping(); err != nil {
		t.Fatalf("Ping: %v", err)
	}
}

func TestOpenEmptyDSN(t *testing.T) {
	if _, err := Open(""); err == nil {
		t.Fatal("ожидалась ошибка для пустого DSN")
	}
}
