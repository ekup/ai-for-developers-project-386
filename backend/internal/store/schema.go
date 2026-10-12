package store

import (
	"context"
	"database/sql"
	"fmt"
)

// schemaStatements — DDL схемы БД. Выполняется при старте и идемпотентна.
var schemaStatements = []string{
	`CREATE TABLE IF NOT EXISTS event_types (
		id               INTEGER PRIMARY KEY AUTOINCREMENT,
		name             TEXT NOT NULL,
		description      TEXT NOT NULL DEFAULT '',
		duration_minutes INTEGER NOT NULL,
		deleted_at       TIMESTAMP NULL
	)`,
	`CREATE TABLE IF NOT EXISTS bookings (
		id            INTEGER PRIMARY KEY AUTOINCREMENT,
		event_type_id INTEGER NOT NULL REFERENCES event_types(id),
		starts_at     TIMESTAMP NOT NULL,
		guest_name    TEXT NOT NULL,
		guest_email   TEXT NOT NULL,
		comment       TEXT NOT NULL DEFAULT '',
		created_at    TIMESTAMP NOT NULL
	)`,
}

// Migrate создаёт схему БД, если её ещё нет.
func Migrate(ctx context.Context, db *sql.DB) error {
	for i, stmt := range schemaStatements {
		if _, err := db.ExecContext(ctx, stmt); err != nil {
			return fmt.Errorf("store: применить схему (шаг %d): %w", i+1, err)
		}
	}

	return nil
}
