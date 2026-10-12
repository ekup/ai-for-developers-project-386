package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"
)

// ErrConflict возвращается, когда интервал новой записи пересекается с уже
// существующей записью.
var ErrConflict = errors.New("store: слот уже занят")

// ErrUnprocessable возвращается, когда запрошенное время недоступно для записи:
// вне окна записи, рабочих часов или в прошлом.
var ErrUnprocessable = errors.New("store: время недоступно для записи")

// Booking — созданная запись гостя вместе с её типом события.
type Booking struct {
	ID         int64
	EventType  EventType
	StartsAt   time.Time
	GuestName  string
	GuestEmail string
	Comment    string
}

// CreateBookingParams — данные для создания записи.
type CreateBookingParams struct {
	EventTypeID int64
	StartsAt    time.Time
	GuestName   string
	GuestEmail  string
	Comment     string
}

// CreateBooking создаёт запись гостя на слот.
//
// Тип события должен существовать и быть активным, время — попадать в окно
// записи и рабочие часы и быть в будущем, а интервал записи — не пересекаться
// ни с одной существующей записью (в том числе другого типа события).
//
// Проверка занятости и вставка выполняются в одной транзакции; соединение
// открыто с BEGIN IMMEDIATE (см. store.Open и docs/adr/0002), поэтому
// одновременные запросы не создают двойную запись.
//
// Ошибки: ErrNotFound — тип события отсутствует или удалён; ErrConflict —
// интервал пересекается с существующей записью; ErrUnprocessable — время вне
// окна записи, рабочих часов или в прошлом.
func CreateBooking(ctx context.Context, db *sql.DB, p CreateBookingParams, now time.Time) (Booking, error) {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return Booking{}, fmt.Errorf("store: начать транзакцию записи: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	eventType, err := getEventType(ctx, tx, p.EventTypeID)
	if err != nil {
		return Booking{}, err
	}

	if err := ensureBookable(p.StartsAt, eventType.DurationMinutes, now); err != nil {
		return Booking{}, err
	}

	occupied, err := occupiedIntervals(ctx, tx)
	if err != nil {
		return Booking{}, err
	}

	end := p.StartsAt.Add(time.Duration(eventType.DurationMinutes) * time.Minute)
	if overlapsAny(p.StartsAt, end, occupied) {
		return Booking{}, ErrConflict
	}

	res, err := tx.ExecContext(
		ctx,
		`INSERT INTO bookings (event_type_id, starts_at, guest_name, guest_email, comment, created_at)
		 VALUES (?, ?, ?, ?, ?, ?)`,
		eventType.ID, p.StartsAt, p.GuestName, p.GuestEmail, p.Comment, now,
	)
	if err != nil {
		return Booking{}, fmt.Errorf("store: вставить запись: %w", err)
	}

	id, err := res.LastInsertId()
	if err != nil {
		return Booking{}, fmt.Errorf("store: получить идентификатор записи: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return Booking{}, fmt.Errorf("store: зафиксировать запись: %w", err)
	}

	return Booking{
		ID:         id,
		EventType:  eventType,
		StartsAt:   p.StartsAt,
		GuestName:  p.GuestName,
		GuestEmail: p.GuestEmail,
		Comment:    p.Comment,
	}, nil
}

// UpcomingBookings возвращает предстоящие (начало не раньше now) записи всех
// типов событий вместе с их типами, отсортированные по времени начала по
// возрастанию. Записи мягко удалённых типов событий остаются видимыми — фильтр
// по deleted_at не применяется.
func UpcomingBookings(ctx context.Context, db *sql.DB, now time.Time) ([]Booking, error) {
	rows, err := db.QueryContext(
		ctx,
		`SELECT b.id, b.starts_at, b.guest_name, b.guest_email, b.comment,
		        e.id, e.name, e.description, e.duration_minutes
		   FROM bookings b
		   JOIN event_types e ON e.id = b.event_type_id
		  WHERE b.starts_at >= ?
		  ORDER BY b.starts_at, b.id`,
		now,
	)
	if err != nil {
		return nil, fmt.Errorf("store: выбрать предстоящие записи: %w", err)
	}
	defer func() { _ = rows.Close() }()

	bookings := make([]Booking, 0)
	for rows.Next() {
		var b Booking
		if err := rows.Scan(
			&b.ID, &b.StartsAt, &b.GuestName, &b.GuestEmail, &b.Comment,
			&b.EventType.ID, &b.EventType.Name, &b.EventType.Description, &b.EventType.DurationMinutes,
		); err != nil {
			return nil, fmt.Errorf("store: прочитать предстоящую запись: %w", err)
		}
		bookings = append(bookings, b)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("store: перебрать предстоящие записи: %w", err)
	}

	return bookings, nil
}

// ensureBookable проверяет, что запись начнётся в будущем, на сетке слотов,
// попадёт в окно записи и целиком уложится в рабочие часы своего дня.
func ensureBookable(start time.Time, durationMinutes int64, now time.Time) error {
	duration := time.Duration(durationMinutes) * time.Minute
	if duration <= 0 || start.Before(now) {
		return ErrUnprocessable
	}

	day, inWindow := dayInWindow(start, now)
	if !inWindow {
		return ErrUnprocessable
	}

	workdayStart, workdayEnd := workdayBounds(day)
	if start.Before(workdayStart) || start.Add(duration).After(workdayEnd) {
		return ErrUnprocessable
	}

	if start.Sub(workdayStart)%(slotStepMinutes*time.Minute) != 0 {
		return ErrUnprocessable
	}

	return nil
}
