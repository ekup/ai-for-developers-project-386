package store

import (
	"context"
	"database/sql"
	"fmt"
	"time"
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

// CreateEventTypeParams — данные для создания типа события.
type CreateEventTypeParams struct {
	Name            string
	Description     string
	DurationMinutes int64
}

// CreateEventType создаёт тип события. Идентификатор назначает база.
func CreateEventType(ctx context.Context, db *sql.DB, p CreateEventTypeParams) (EventType, error) {
	res, err := db.ExecContext(
		ctx,
		`INSERT INTO event_types (name, description, duration_minutes) VALUES (?, ?, ?)`,
		p.Name, p.Description, p.DurationMinutes,
	)
	if err != nil {
		return EventType{}, fmt.Errorf("store: вставить тип события: %w", err)
	}

	id, err := res.LastInsertId()
	if err != nil {
		return EventType{}, fmt.Errorf("store: получить идентификатор типа события: %w", err)
	}

	return EventType{
		ID:              id,
		Name:            p.Name,
		Description:     p.Description,
		DurationMinutes: p.DurationMinutes,
	}, nil
}

// UpdateEventTypeParams — новые название и описание типа события.
type UpdateEventTypeParams struct {
	Name        string
	Description string
}

// UpdateEventType меняет название и описание активного (не удалённого) типа
// события. Длительность не меняется. Если тип отсутствует или удалён,
// возвращается ErrNotFound.
func UpdateEventType(ctx context.Context, db *sql.DB, id int64, p UpdateEventTypeParams) (EventType, error) {
	res, err := db.ExecContext(
		ctx,
		`UPDATE event_types SET name = ?, description = ? WHERE id = ? AND deleted_at IS NULL`,
		p.Name, p.Description, id,
	)
	if err != nil {
		return EventType{}, fmt.Errorf("store: обновить тип события: %w", err)
	}

	changed, err := res.RowsAffected()
	if err != nil {
		return EventType{}, fmt.Errorf("store: проверить результат обновления: %w", err)
	}
	if changed == 0 {
		return EventType{}, ErrNotFound
	}

	return getEventType(ctx, db, id)
}

// DeleteEventType мягко удаляет тип события, помечая его deleted_at. Записи
// этого типа сохраняются. Если тип отсутствует или уже удалён, возвращается
// ErrNotFound.
func DeleteEventType(ctx context.Context, db *sql.DB, id int64, now time.Time) error {
	res, err := db.ExecContext(
		ctx,
		`UPDATE event_types SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL`,
		now, id,
	)
	if err != nil {
		return fmt.Errorf("store: мягко удалить тип события: %w", err)
	}

	changed, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("store: проверить результат удаления: %w", err)
	}
	if changed == 0 {
		return ErrNotFound
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
