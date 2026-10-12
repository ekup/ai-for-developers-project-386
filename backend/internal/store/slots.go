package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"
)

// Правила сетки слотов и окна записи (docs/spec.md, раздел 5).
const (
	slotStepMinutes   = 15
	workdayStartHour  = 9
	workdayEndHour    = 18
	bookingWindowDays = 14
)

// ErrNotFound возвращается, когда запрошенная сущность отсутствует.
var ErrNotFound = errors.New("store: не найдено")

// interval — полуинтервал [start, end).
type interval struct {
	start time.Time
	end   time.Time
}

// BookingWindow возвращает первый и последний день окна записи в серверном
// часовом поясе: текущую дату и следующие bookingWindowDays-1 календарных дня.
func BookingWindow(now time.Time) (time.Time, time.Time) {
	start := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	return start, start.AddDate(0, 0, bookingWindowDays-1)
}

// Slots возвращает свободные старты слотов типа события на дату в серверном
// часовом поясе. Сетка стартов — каждые 15 минут в окне 09:00–18:00, конец
// слота не выходит за 18:00. Дата вне 14-дневного окна, прошедшие старты и
// старты, пересекающиеся с существующими записями, исключаются.
//
// Если тип события отсутствует или мягко удалён, возвращается ErrNotFound.
// Если слотов нет по правилам окна, возвращается пустой (не nil) список.
func Slots(ctx context.Context, db *sql.DB, eventTypeID int64, date, now time.Time) ([]time.Time, error) {
	eventType, err := getEventType(ctx, db, eventTypeID)
	if err != nil {
		return nil, err
	}

	slots := make([]time.Time, 0)

	windowStart, windowEnd := BookingWindow(now)
	day := time.Date(date.Year(), date.Month(), date.Day(), 0, 0, 0, 0, windowStart.Location())
	if day.Before(windowStart) || day.After(windowEnd) {
		return slots, nil
	}

	duration := time.Duration(eventType.DurationMinutes) * time.Minute
	workdayStart := day.Add(workdayStartHour * time.Hour)
	workdayEnd := day.Add(workdayEndHour * time.Hour)
	if duration <= 0 || duration > workdayEnd.Sub(workdayStart) {
		return slots, nil
	}

	occupied, err := occupiedIntervals(ctx, db)
	if err != nil {
		return nil, err
	}

	for start := workdayStart; !start.Add(duration).After(workdayEnd); start = start.Add(slotStepMinutes * time.Minute) {
		if start.Before(now) {
			continue
		}
		if overlapsAny(start, start.Add(duration), occupied) {
			continue
		}
		slots = append(slots, start)
	}

	return slots, nil
}

// getEventType возвращает активный (не удалённый) тип события.
func getEventType(ctx context.Context, db *sql.DB, id int64) (EventType, error) {
	var et EventType
	err := db.QueryRowContext(
		ctx,
		`SELECT id, name, description, duration_minutes
		   FROM event_types
		  WHERE id = ? AND deleted_at IS NULL`,
		id,
	).Scan(&et.ID, &et.Name, &et.Description, &et.DurationMinutes)
	if errors.Is(err, sql.ErrNoRows) {
		return EventType{}, ErrNotFound
	}
	if err != nil {
		return EventType{}, fmt.Errorf("store: получить тип события: %w", err)
	}

	return et, nil
}

// occupiedIntervals возвращает интервалы всех существующих записей.
func occupiedIntervals(ctx context.Context, db *sql.DB) ([]interval, error) {
	rows, err := db.QueryContext(
		ctx,
		`SELECT b.starts_at, e.duration_minutes
		   FROM bookings b
		   JOIN event_types e ON e.id = b.event_type_id`,
	)
	if err != nil {
		return nil, fmt.Errorf("store: выбрать записи: %w", err)
	}
	defer func() { _ = rows.Close() }()

	var intervals []interval
	for rows.Next() {
		var start time.Time
		var minutes int64
		if err := rows.Scan(&start, &minutes); err != nil {
			return nil, fmt.Errorf("store: прочитать запись: %w", err)
		}
		intervals = append(intervals, interval{
			start: start,
			end:   start.Add(time.Duration(minutes) * time.Minute),
		})
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("store: перебрать записи: %w", err)
	}

	return intervals, nil
}

// overlapsAny сообщает, пересекается ли [start, end) с любым из интервалов.
func overlapsAny(start, end time.Time, intervals []interval) bool {
	for _, iv := range intervals {
		if start.Before(iv.end) && iv.start.Before(end) {
			return true
		}
	}

	return false
}
