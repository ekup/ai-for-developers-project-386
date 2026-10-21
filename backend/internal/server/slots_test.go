package server

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

// slotsBody — тело успешного ответа на запрос слотов.
type slotsBody struct {
	Date  string   `json:"date"`
	Slots []string `json:"slots"`
}

// insertEventType создаёт тип события с заданной длительностью и возвращает его id.
// Используется для подготовки данных, которые ещё не создаются через API.
func insertEventType(t *testing.T, db *sql.DB, durationMinutes int) int32 {
	t.Helper()

	res, err := db.Exec(
		`INSERT INTO event_types (name, description, duration_minutes) VALUES (?, '', ?)`,
		fmt.Sprintf("Тип на %d минут", durationMinutes), durationMinutes,
	)
	if err != nil {
		t.Fatalf("вставить тип события: %v", err)
	}

	id, err := res.LastInsertId()
	if err != nil {
		t.Fatalf("получить id типа события: %v", err)
	}

	return int32(id)
}

// getSlots запрашивает слоты типа события на дату по HTTP и возвращает код и тело.
func getSlots(t *testing.T, router http.Handler, id int32, date string) (int, slotsBody, string) {
	t.Helper()

	url := fmt.Sprintf("/api/event-types/%d/slots?date=%s", id, date)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, url, nil))

	raw := rec.Body.String()

	var body slotsBody
	_ = json.Unmarshal(rec.Body.Bytes(), &body)

	return rec.Code, body, raw
}

// dateString форматирует дату как YYYY-MM-DD.
func dateString(t time.Time) string {
	return t.Format("2006-01-02")
}

// TestBookingsWindowReturnsServerToday проверяет, что окно записи начинается с
// серверной сегодняшней даты и длится 14 дней.
func TestBookingsWindowReturnsServerToday(t *testing.T) {
	router, _ := newSeededRouter(t)

	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/bookings/window", nil))

	if rec.Code != http.StatusOK {
		t.Fatalf("ожидался статус %d, получен %d", http.StatusOK, rec.Code)
	}

	var body struct {
		Start string `json:"start"`
		End   string `json:"end"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("декодировать ответ: %v", err)
	}

	today := time.Now()
	if body.Start != dateString(today) {
		t.Errorf("ожидался start %q, получен %q", dateString(today), body.Start)
	}
	if want := dateString(today.AddDate(0, 0, 13)); body.End != want {
		t.Errorf("ожидался end %q, получен %q", want, body.End)
	}
}

// TestEventTypesSlotsNotFoundForMissingType проверяет 404 для несуществующего типа.
func TestEventTypesSlotsNotFoundForMissingType(t *testing.T) {
	router, _ := newSeededRouter(t)

	code, _, _ := getSlots(t, router, 9999, dateString(time.Now().AddDate(0, 0, 1)))

	if code != http.StatusNotFound {
		t.Fatalf("ожидался статус %d, получен %d", http.StatusNotFound, code)
	}
}

// TestEventTypesSlotsNotFoundForRemovedType проверяет 404 для мягко удалённого типа.
func TestEventTypesSlotsNotFoundForRemovedType(t *testing.T) {
	router, db := newSeededRouter(t)

	id := insertEventType(t, db, 15)
	if _, err := db.Exec(`UPDATE event_types SET deleted_at = datetime('now') WHERE id = ?`, id); err != nil {
		t.Fatalf("мягко удалить тип события: %v", err)
	}

	code, _, _ := getSlots(t, router, id, dateString(time.Now().AddDate(0, 0, 1)))

	if code != http.StatusNotFound {
		t.Fatalf("ожидался статус %d, получен %d", http.StatusNotFound, code)
	}
}

// slotClock переводит старты слотов в время суток HH:MM.
func slotClock(t *testing.T, slots []string) []string {
	t.Helper()

	clock := make([]string, 0, len(slots))
	for _, slot := range slots {
		parsed, err := time.Parse(time.RFC3339, slot)
		if err != nil {
			t.Fatalf("старт слота %q не является RFC3339: %v", slot, err)
		}
		clock = append(clock, parsed.Format("15:04"))
	}

	return clock
}

// TestEventTypesSlotsGridStep проверяет сетку 30 минут, окно 09:00–18:00 и
// укладку записи в окно: для 15 минут последний старт — 17:30.
func TestEventTypesSlotsGridStep(t *testing.T) {
	router, db := newSeededRouter(t)
	id := insertEventType(t, db, 15)

	date := dateString(time.Now().AddDate(0, 0, 1))
	code, body, _ := getSlots(t, router, id, date)

	if code != http.StatusOK {
		t.Fatalf("ожидался статус %d, получен %d", http.StatusOK, code)
	}
	if body.Date != date {
		t.Errorf("ожидалась дата %q, получена %q", date, body.Date)
	}

	clock := slotClock(t, body.Slots)
	if len(clock) != 18 {
		t.Fatalf("ожидалось 18 слотов, получено %d: %v", len(clock), clock)
	}
	if clock[0] != "09:00" {
		t.Errorf("ожидался первый слот 09:00, получен %q", clock[0])
	}
	if clock[len(clock)-1] != "17:30" {
		t.Errorf("ожидался последний слот 17:30, получен %q", clock[len(clock)-1])
	}
	for i := 1; i < len(clock); i++ {
		prev, _ := time.Parse("15:04", clock[i-1])
		cur, _ := time.Parse("15:04", clock[i])
		if cur.Sub(prev) != 30*time.Minute {
			t.Fatalf("шаг между %q и %q не равен 30 минутам", clock[i-1], clock[i])
		}
	}
}

// TestEventTypesSlotsEndFitsWorkday проверяет, что конец слота не выходит за
// 18:00: для 30 минут последний старт — 17:30.
func TestEventTypesSlotsEndFitsWorkday(t *testing.T) {
	router, db := newSeededRouter(t)
	id := insertEventType(t, db, 30)

	code, body, _ := getSlots(t, router, id, dateString(time.Now().AddDate(0, 0, 1)))
	if code != http.StatusOK {
		t.Fatalf("ожидался статус %d, получен %d", http.StatusOK, code)
	}

	clock := slotClock(t, body.Slots)
	if len(clock) != 18 {
		t.Fatalf("ожидалось 18 слотов, получено %d: %v", len(clock), clock)
	}
	if clock[len(clock)-1] != "17:30" {
		t.Errorf("ожидался последний слот 17:30, получен %q", clock[len(clock)-1])
	}
}

// TestEventTypesSlotsDurationWithinWorkday проверяет границу длительности:
// ровно 9 часов даёт единственный слот 09:00, 541 минута — ни одного.
func TestEventTypesSlotsDurationWithinWorkday(t *testing.T) {
	router, db := newSeededRouter(t)
	date := dateString(time.Now().AddDate(0, 0, 1))

	nineHours := insertEventType(t, db, 9*60)
	code, body, _ := getSlots(t, router, nineHours, date)
	if code != http.StatusOK {
		t.Fatalf("ожидался статус %d, получен %d", http.StatusOK, code)
	}
	if clock := slotClock(t, body.Slots); len(clock) != 1 || clock[0] != "09:00" {
		t.Fatalf("для 9 часов ожидался единственный слот 09:00, получено %v", clock)
	}

	longer := insertEventType(t, db, 9*60+1)
	code, body, _ = getSlots(t, router, longer, date)
	if code != http.StatusOK {
		t.Fatalf("ожидался статус %d, получен %d", http.StatusOK, code)
	}
	if len(body.Slots) != 0 {
		t.Fatalf("для длительности больше рабочего дня ожидалось 0 слотов, получено %v", body.Slots)
	}
}

// TestEventTypesSlotsBookingWindow проверяет границы 14-дневного окна записи
// и недоступность прошедших дат.
func TestEventTypesSlotsBookingWindow(t *testing.T) {
	router, db := newSeededRouter(t)
	id := insertEventType(t, db, 15)
	today := time.Now()

	t.Run("сегодня", func(t *testing.T) {
		code, _, _ := getSlots(t, router, id, dateString(today))
		if code != http.StatusOK {
			t.Fatalf("ожидался статус %d, получен %d", http.StatusOK, code)
		}
	})

	t.Run("последний день окна", func(t *testing.T) {
		code, body, _ := getSlots(t, router, id, dateString(today.AddDate(0, 0, 13)))
		if code != http.StatusOK {
			t.Fatalf("ожидался статус %d, получен %d", http.StatusOK, code)
		}
		if len(body.Slots) == 0 {
			t.Fatal("на последнем дне окна ожидались слоты")
		}
	})

	t.Run("за днём окна", func(t *testing.T) {
		code, body, raw := getSlots(t, router, id, dateString(today.AddDate(0, 0, 14)))
		if code != http.StatusOK {
			t.Fatalf("ожидался статус %d, получен %d", http.StatusOK, code)
		}
		if len(body.Slots) != 0 {
			t.Fatalf("за окном ожидалось 0 слотов, получено %v", body.Slots)
		}
		if !strings.Contains(raw, `"slots":[]`) {
			t.Errorf("пустой список слотов должен сериализоваться как [], получено %q", raw)
		}
	})

	t.Run("вчера", func(t *testing.T) {
		code, body, _ := getSlots(t, router, id, dateString(today.AddDate(0, 0, -1)))
		if code != http.StatusOK {
			t.Fatalf("ожидался статус %d, получен %d", http.StatusOK, code)
		}
		if len(body.Slots) != 0 {
			t.Fatalf("для прошедшей даты ожидалось 0 слотов, получено %v", body.Slots)
		}
	})
}

// TestEventTypesSlotsSkipPastStarts проверяет, что для сегодняшнего дня
// прошедшие старты не возвращаются: все слоты не раньше текущего момента.
func TestEventTypesSlotsSkipPastStarts(t *testing.T) {
	router, db := newSeededRouter(t)
	id := insertEventType(t, db, 15)

	now := time.Now()
	code, body, _ := getSlots(t, router, id, dateString(now))
	if code != http.StatusOK {
		t.Fatalf("ожидался статус %d, получен %d", http.StatusOK, code)
	}

	for _, slot := range body.Slots {
		parsed, err := time.Parse(time.RFC3339, slot)
		if err != nil {
			t.Fatalf("старт слота %q не является RFC3339: %v", slot, err)
		}
		if parsed.Before(now) {
			t.Fatalf("вернулся прошедший слот %s", slot)
		}
	}
}
