package store

import (
	"context"
	"database/sql"
	"fmt"
)

// EventType — тип события: шаблон встречи, по которому гость выбирает слот.
type EventType struct {
	ID              int64
	Name            string
	Description     string
	DurationMinutes int64
}

// seedEventTypes — типы событий, создаваемые при первом запуске.
var seedEventTypes = []EventType{
	{
		Name:            "Короткий звонок",
		Description:     "Знакомство, быстрый вопрос или уточнение",
		DurationMinutes: 15,
	},
	{
		Name:            "Звонок",
		Description:     "Обсуждение задачи, проекта или консультация",
		DurationMinutes: 30,
	},
}

// SeedEventTypes создаёт seed-типы событий, если таблица типов пуста.
// Повторные вызовы ничего не меняют.
func SeedEventTypes(ctx context.Context, db *sql.DB) error {
	var count int
	if err := db.QueryRowContext(ctx, `SELECT COUNT(*) FROM event_types`).Scan(&count); err != nil {
		return fmt.Errorf("store: посчитать типы событий: %w", err)
	}
	if count > 0 {
		return nil
	}

	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("store: начать транзакцию посева: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	for _, et := range seedEventTypes {
		if _, err := tx.ExecContext(
			ctx,
			`INSERT INTO event_types (name, description, duration_minutes) VALUES (?, ?, ?)`,
			et.Name, et.Description, et.DurationMinutes,
		); err != nil {
			return fmt.Errorf("store: вставить seed-тип события: %w", err)
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("store: зафиксировать посев: %w", err)
	}

	return nil
}

// ListEventTypes возвращает активные (не удалённые) типы событий по возрастанию id.
func ListEventTypes(ctx context.Context, db *sql.DB) ([]EventType, error) {
	rows, err := db.QueryContext(
		ctx,
		`SELECT id, name, description, duration_minutes
		   FROM event_types
		  WHERE deleted_at IS NULL
		  ORDER BY id`,
	)
	if err != nil {
		return nil, fmt.Errorf("store: выбрать типы событий: %w", err)
	}
	defer func() { _ = rows.Close() }()

	var types []EventType
	for rows.Next() {
		var et EventType
		if err := rows.Scan(&et.ID, &et.Name, &et.Description, &et.DurationMinutes); err != nil {
			return nil, fmt.Errorf("store: прочитать тип события: %w", err)
		}
		types = append(types, et)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("store: перебрать типы событий: %w", err)
	}

	return types, nil
}
