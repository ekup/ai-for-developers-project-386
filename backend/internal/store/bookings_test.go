package store

import (
	"context"
	"database/sql"
	"errors"
	"path/filepath"
	"sync"
	"testing"
	"time"
)

// TestCreateBookingConcurrentSameSlot проверяет гарантию спеки (§6.4): при
// одновременных заявках на один и тот же слот ровно одна создаёт запись,
// остальные получают ErrConflict, а в БД остаётся ровно одна запись.
//
// Гарантия держится на двух свойствах store.Open — `_txlock=immediate` и
// MaxOpenConns(1). Если любое из них сломать, SQLite начнёт создавать дубликаты
// или отвечать «database is locked» вместо конфликта, и проверки ниже падают.
func TestCreateBookingConcurrentSameSlot(t *testing.T) {
	db := openTestDB(t)
	ctx := context.Background()

	eventType, err := CreateEventType(ctx, db, CreateEventTypeParams{
		Name:            "Звонок",
		Description:     "Обсуждение задачи",
		DurationMinutes: 30,
	})
	if err != nil {
		t.Fatalf("создать тип события: %v", err)
	}

	now := time.Now()
	tomorrow := now.AddDate(0, 0, 1)
	startsAt := time.Date(tomorrow.Year(), tomorrow.Month(), tomorrow.Day(), 10, 0, 0, 0, now.Location())

	const attempts = 10

	var wg sync.WaitGroup
	ready := make(chan struct{})
	errs := make([]error, attempts)
	bookings := make([]Booking, attempts)

	wg.Add(attempts)
	for i := range attempts {
		go func() {
			defer wg.Done()
			<-ready
			bookings[i], errs[i] = CreateBooking(ctx, db, CreateBookingParams{
				EventTypeID: eventType.ID,
				StartsAt:    startsAt,
				GuestName:   "Гость " + string(rune('А'+i)),
				GuestEmail:  "guest@example.com",
			}, now)
		}()
	}
	close(ready)
	wg.Wait()

	created := -1
	conflicts := 0
	for i, err := range errs {
		switch {
		case err == nil:
			created = i
		case errors.Is(err, ErrConflict):
			conflicts++
		default:
			t.Errorf("заявка %d: ожидался успех или ErrConflict, получено: %v", i+1, err)
		}
	}

	if created == -1 {
		t.Fatalf("ожидалась ровно одна успешная заявка, успешных нет")
	}
	if conflicts != attempts-1 {
		t.Fatalf("ожидалось %d конфликтов, получено %d", attempts-1, conflicts)
	}
	if !bookings[created].StartsAt.Equal(startsAt) {
		t.Errorf("успешная запись начинается в %s, ожидалось %s", bookings[created].StartsAt, startsAt)
	}

	var count int
	if err := db.QueryRowContext(ctx, `SELECT COUNT(*) FROM bookings`).Scan(&count); err != nil {
		t.Fatalf("посчитать записи: %v", err)
	}
	if count != 1 {
		t.Fatalf("в БД %d записей на один слот, ожидалась 1", count)
	}
}

// TestOpenSerializesWrites проверяет настройки, на которых держится гарантия
// отсутствия двойной записи: единственное соединение и транзакции с BEGIN
// IMMEDIATE. Без этих проверок регрессию в store.Open поймал бы только
// конкурентный тест выше, и то не всегда детерминированно.
func TestOpenSerializesWrites(t *testing.T) {
	db := openTestDB(t)

	if got := db.Stats().MaxOpenConnections; got != 1 {
		t.Errorf("MaxOpenConnections = %d, ожидалось 1", got)
	}

	cases := map[string]string{
		"app.db":          "app.db?_txlock=immediate",
		"app.db?mode=rwc": "app.db?mode=rwc&_txlock=immediate",
	}
	for dsn, want := range cases {
		if got := withTxLock(dsn); got != want {
			t.Errorf("withTxLock(%q) = %q, ожидалось %q", dsn, got, want)
		}
	}
}

// openTestDB открывает временную БД с применённой схемой и закрывает её по
// завершении теста.
func openTestDB(t *testing.T) *sql.DB {
	t.Helper()

	db, err := Open(filepath.Join(t.TempDir(), "app.db"))
	if err != nil {
		t.Fatalf("открыть тестовую БД: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })

	if err := Migrate(context.Background(), db); err != nil {
		t.Fatalf("применить схему: %v", err)
	}

	return db
}
