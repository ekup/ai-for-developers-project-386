package server

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/ekup/ai-for-developers-project-386/backend/internal/api"
)

// insertBooking вставляет запись напрямую в БД с заданным началом. Так
// готовятся данные, которые нельзя создать через API, — прежде всего записи в
// прошлом.
func insertBooking(t *testing.T, db *sql.DB, eventTypeID int32, startsAt time.Time, name, email, comment string) {
	t.Helper()

	if _, err := db.Exec(
		`INSERT INTO bookings (event_type_id, starts_at, guest_name, guest_email, comment, created_at)
		 VALUES (?, ?, ?, ?, ?, ?)`,
		eventTypeID, startsAt, name, email, comment, time.Now(),
	); err != nil {
		t.Fatalf("вставить запись: %v", err)
	}
}

// getUpcoming запрашивает предстоящие встречи по HTTP и декодирует ответ.
func getUpcoming(t *testing.T, router http.Handler) []api.Booking {
	t.Helper()

	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/bookings/upcoming", nil))

	if rec.Code != http.StatusOK {
		t.Fatalf("ожидался статус %d, получен %d, тело: %s", http.StatusOK, rec.Code, rec.Body.String())
	}

	var bookings []api.Booking
	if err := json.Unmarshal(rec.Body.Bytes(), &bookings); err != nil {
		t.Fatalf("декодировать ответ: %v", err)
	}

	return bookings
}

// TestBookingsUpcomingReturnsFutureSortedByStart проверяет, что единый список
// идёт по возрастанию времени начала и содержит тип события и данные гостя.
func TestBookingsUpcomingReturnsFutureSortedByStart(t *testing.T) {
	router, db := newSeededRouter(t)
	id := insertEventType(t, db, 30)

	// Записи вставляются вразнобой — победить их должен порядок по началу.
	insertBooking(t, db, id, tomorrowAt(15, 30), "Вера", "vera@example.com", "")
	insertBooking(t, db, id, tomorrowAt(9, 0), "Анна", "anna@example.com", "Позвоните заранее")
	insertBooking(t, db, id, tomorrowAt(11, 15), "Борис", "boris@example.com", "")

	bookings := getUpcoming(t, router)

	if len(bookings) != 3 {
		t.Fatalf("ожидалось 3 встречи, получено %d", len(bookings))
	}

	wantClock := []string{"09:00", "11:15", "15:30"}
	for i, want := range wantClock {
		if got := bookings[i].StartsAt.Format("15:04"); got != want {
			t.Errorf("запись %d: ожидалось начало %s, получено %s", i, want, got)
		}
	}

	first := bookings[0]
	if first.EventType.Id != id || first.EventType.DurationMinutes != 30 || first.EventType.Name == "" {
		t.Errorf("в первой записи неверный тип события: %+v", first.EventType)
	}
	if first.GuestName != "Анна" || first.GuestEmail != "anna@example.com" {
		t.Errorf("в первой записи неверные данные гостя: %q, %q", first.GuestName, first.GuestEmail)
	}
	if first.Comment != "Позвоните заранее" {
		t.Errorf("в первой записи неверный комментарий: %q", first.Comment)
	}
}

// TestBookingsUpcomingHidesPast проверяет, что прошедшие встречи не попадают
// в список.
func TestBookingsUpcomingHidesPast(t *testing.T) {
	router, db := newSeededRouter(t)
	id := insertEventType(t, db, 15)

	insertBooking(t, db, id, tomorrowAt(9, 0).AddDate(0, 0, -2), "Прошлая", "past@example.com", "")
	insertBooking(t, db, id, tomorrowAt(9, 0), "Предстоящая", "future@example.com", "")

	bookings := getUpcoming(t, router)

	if len(bookings) != 1 {
		t.Fatalf("ожидалась 1 предстоящая встреча, получено %d", len(bookings))
	}
	if bookings[0].GuestName != "Предстоящая" {
		t.Errorf("в списке оказалась прошедшая встреча: %+v", bookings[0])
	}
}

// TestBookingsUpcomingKeepsSoftDeletedTypeBookings проверяет, что записи мягко
// удалённых типов событий остаются видимыми владельцу вместе со своим типом.
func TestBookingsUpcomingKeepsSoftDeletedTypeBookings(t *testing.T) {
	router, db := newSeededRouter(t)
	id := insertEventType(t, db, 15)
	insertBooking(t, db, id, tomorrowAt(9, 0), "Анна", "anna@example.com", "")

	if _, err := db.Exec(`UPDATE event_types SET deleted_at = datetime('now') WHERE id = ?`, id); err != nil {
		t.Fatalf("мягко удалить тип события: %v", err)
	}

	bookings := getUpcoming(t, router)

	if len(bookings) != 1 {
		t.Fatalf("ожидалась 1 встреча мягко удалённого типа, получено %d", len(bookings))
	}
	if bookings[0].EventType.Id != id {
		t.Errorf("встреча относится не к тому типу: %+v", bookings[0].EventType)
	}
	if bookings[0].EventType.Name == "" || bookings[0].EventType.DurationMinutes != 15 {
		t.Errorf("в записи неверный тип события: %+v", bookings[0].EventType)
	}
}
