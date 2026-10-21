package server

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

// bookingRequest — тело запроса на создание записи в тестах.
type bookingRequest struct {
	EventTypeID int64     `json:"eventTypeId"`
	StartsAt    time.Time `json:"startsAt"`
	GuestName   string    `json:"guestName"`
	GuestEmail  string    `json:"guestEmail"`
	Comment     string    `json:"comment,omitempty"`
}

// bookingResponse — тело успешного ответа на создание записи.
type bookingResponse struct {
	ID         int64  `json:"id"`
	StartsAt   string `json:"startsAt"`
	GuestName  string `json:"guestName"`
	GuestEmail string `json:"guestEmail"`
	Comment    string `json:"comment"`
	EventType  struct {
		ID              int64  `json:"id"`
		Name            string `json:"name"`
		Description     string `json:"description"`
		DurationMinutes int64  `json:"durationMinutes"`
	} `json:"eventType"`
}

// postBooking отправляет POST /api/bookings и возвращает код и сырое тело.
func postBooking(t *testing.T, router http.Handler, req bookingRequest) (int, []byte) {
	t.Helper()

	payload, err := json.Marshal(req)
	if err != nil {
		t.Fatalf("сериализовать запрос: %v", err)
	}

	rec := httptest.NewRecorder()
	httpReq := httptest.NewRequest(http.MethodPost, "/api/bookings", bytes.NewReader(payload))
	httpReq.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(rec, httpReq)

	return rec.Code, rec.Body.Bytes()
}

// tomorrowAt возвращает момент на следующий день в заданное время по серверному
// часовому поясу — он всегда в пределах окна записи и в будущем.
func tomorrowAt(hour, minute int) time.Time {
	now := time.Now()
	day := now.AddDate(0, 0, 1)
	return time.Date(day.Year(), day.Month(), day.Day(), hour, minute, 0, 0, now.Location())
}

// TestBookingsCreateCreatesBooking проверяет, что валидный запрос создаёт
// запись с деталями и что занятый слот пропадает из свободных.
func TestBookingsCreateCreatesBooking(t *testing.T) {
	router, db := newSeededRouter(t)
	id := insertEventType(t, db, 15)
	startsAt := tomorrowAt(9, 0)

	code, raw := postBooking(t, router, bookingRequest{
		EventTypeID: int64(id),
		StartsAt:    startsAt,
		GuestName:   "Анна",
		GuestEmail:  "anna@example.com",
		Comment:     "Позвоните заранее",
	})

	if code != http.StatusCreated {
		t.Fatalf("ожидался статус %d, получен %d, тело: %s", http.StatusCreated, code, raw)
	}

	var body bookingResponse
	if err := json.Unmarshal(raw, &body); err != nil {
		t.Fatalf("декодировать ответ: %v", err)
	}

	if body.ID == 0 {
		t.Error("в ответе не задан идентификатор записи")
	}
	if body.EventType.ID != int64(id) || body.EventType.DurationMinutes != 15 {
		t.Errorf("в ответе неверный тип события: %+v", body.EventType)
	}
	if body.GuestName != "Анна" || body.GuestEmail != "anna@example.com" {
		t.Errorf("в ответе неверные данные гостя: %q, %q", body.GuestName, body.GuestEmail)
	}
	if body.Comment != "Позвоните заранее" {
		t.Errorf("в ответе неверный комментарий: %q", body.Comment)
	}

	created, err := time.Parse(time.RFC3339, body.StartsAt)
	if err != nil {
		t.Fatalf("startsAt в ответе не RFC3339: %v", err)
	}
	if !created.Equal(startsAt) {
		t.Errorf("ожидался startsAt %s, получен %s", startsAt, created)
	}

	_, slots, _ := getSlots(t, router, id, dateString(startsAt))
	for _, clock := range slotClock(t, slots.Slots) {
		if clock == "09:00" {
			t.Error("занятый слот 09:00 остался среди свободных")
		}
	}
}

// TestBookingsCreateValidatesRequiredFields проверяет 400, когда имя или email
// не заданы либо email не является корректным адресом.
func TestBookingsCreateValidatesRequiredFields(t *testing.T) {
	router, db := newSeededRouter(t)
	id := insertEventType(t, db, 15)
	startsAt := tomorrowAt(9, 0)

	cases := []struct {
		name string
		req  bookingRequest
	}{
		{
			name: "пустое имя",
			req:  bookingRequest{EventTypeID: int64(id), StartsAt: startsAt, GuestEmail: "anna@example.com"},
		},
		{
			name: "пустой email",
			req:  bookingRequest{EventTypeID: int64(id), StartsAt: startsAt, GuestName: "Анна"},
		},
		{
			name: "некорректный email",
			req: bookingRequest{
				EventTypeID: int64(id), StartsAt: startsAt, GuestName: "Анна", GuestEmail: "не-почта",
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			code, raw := postBooking(t, router, tc.req)
			if code != http.StatusBadRequest {
				t.Fatalf("ожидался статус %d, получен %d, тело: %s", http.StatusBadRequest, code, raw)
			}
		})
	}
}

// TestBookingsCreateNotFoundForMissingOrRemovedType проверяет 404 для
// отсутствующего и мягко удалённого типа события.
func TestBookingsCreateNotFoundForMissingOrRemovedType(t *testing.T) {
	router, db := newSeededRouter(t)
	startsAt := tomorrowAt(9, 0)

	t.Run("отсутствующий тип", func(t *testing.T) {
		code, raw := postBooking(t, router, bookingRequest{
			EventTypeID: 9999, StartsAt: startsAt, GuestName: "Анна", GuestEmail: "anna@example.com",
		})
		if code != http.StatusNotFound {
			t.Fatalf("ожидался статус %d, получен %d, тело: %s", http.StatusNotFound, code, raw)
		}
	})

	t.Run("удалённый тип", func(t *testing.T) {
		id := insertEventType(t, db, 15)
		if _, err := db.Exec(`UPDATE event_types SET deleted_at = datetime('now') WHERE id = ?`, id); err != nil {
			t.Fatalf("мягко удалить тип события: %v", err)
		}

		code, raw := postBooking(t, router, bookingRequest{
			EventTypeID: int64(id), StartsAt: startsAt, GuestName: "Анна", GuestEmail: "anna@example.com",
		})
		if code != http.StatusNotFound {
			t.Fatalf("ожидался статус %d, получен %d, тело: %s", http.StatusNotFound, code, raw)
		}
	})
}

// TestBookingsCreateRejectsUnavailableTime проверяет 422 для времени в прошлом,
// вне окна записи, вне рабочих часов и не на сетке слотов.
func TestBookingsCreateRejectsUnavailableTime(t *testing.T) {
	router, db := newSeededRouter(t)
	id := insertEventType(t, db, 15)

	cases := []struct {
		name     string
		startsAt time.Time
	}{
		{name: "в прошлом", startsAt: tomorrowAt(9, 0).AddDate(0, 0, -2)},
		{name: "вне окна записи", startsAt: tomorrowAt(9, 0).AddDate(0, 0, 14)},
		{name: "до начала рабочего дня", startsAt: tomorrowAt(8, 45)},
		{name: "не укладывается в рабочий день", startsAt: tomorrowAt(18, 0)},
		{name: "не по сетке слотов: 09:15", startsAt: tomorrowAt(9, 15)},
		{name: "не по сетке слотов: 09:45", startsAt: tomorrowAt(9, 45)},
		{name: "не по сетке слотов: 09:07", startsAt: tomorrowAt(9, 7)},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			code, raw := postBooking(t, router, bookingRequest{
				EventTypeID: int64(id), StartsAt: tc.startsAt, GuestName: "Анна", GuestEmail: "anna@example.com",
			})
			if code != http.StatusUnprocessableEntity {
				t.Fatalf("ожидался статус %d, получен %d, тело: %s", http.StatusUnprocessableEntity, code, raw)
			}
		})
	}
}

// TestBookingsCreateConflictOnOverlapAcrossTypes проверяет 409 при частичном
// пересечении интервалов записей разных типов событий.
func TestBookingsCreateConflictOnOverlapAcrossTypes(t *testing.T) {
	router, db := newSeededRouter(t)
	longID := insertEventType(t, db, 45)
	shortID := insertEventType(t, db, 30)

	code, raw := postBooking(t, router, bookingRequest{
		EventTypeID: int64(longID), StartsAt: tomorrowAt(9, 0), GuestName: "Анна", GuestEmail: "anna@example.com",
	})
	if code != http.StatusCreated {
		t.Fatalf("первая запись: ожидался статус %d, получен %d, тело: %s", http.StatusCreated, code, raw)
	}

	code, raw = postBooking(t, router, bookingRequest{
		EventTypeID: int64(shortID), StartsAt: tomorrowAt(9, 30), GuestName: "Борис", GuestEmail: "boris@example.com",
	})
	if code != http.StatusConflict {
		t.Fatalf("пересечение: ожидался статус %d, получен %d, тело: %s", http.StatusConflict, code, raw)
	}
}

// TestBookingsCreateAllowsAdjacentSlots проверяет, что интервалы считаются
// полуинтервалами [начало, конец): соседние записи не конфликтуют, а занятое
// время занято и для повторной записи.
func TestBookingsCreateAllowsAdjacentSlots(t *testing.T) {
	router, db := newSeededRouter(t)
	longID := insertEventType(t, db, 30)
	shortID := insertEventType(t, db, 15)

	code, raw := postBooking(t, router, bookingRequest{
		EventTypeID: int64(longID), StartsAt: tomorrowAt(9, 0), GuestName: "Анна", GuestEmail: "anna@example.com",
	})
	if code != http.StatusCreated {
		t.Fatalf("первая запись: ожидался статус %d, получен %d, тело: %s", http.StatusCreated, code, raw)
	}

	// [09:30, 09:45) встык к [09:00, 09:30) — пересечения нет.
	code, raw = postBooking(t, router, bookingRequest{
		EventTypeID: int64(shortID), StartsAt: tomorrowAt(9, 30), GuestName: "Борис", GuestEmail: "boris@example.com",
	})
	if code != http.StatusCreated {
		t.Fatalf("соседняя запись: ожидался статус %d, получен %d, тело: %s", http.StatusCreated, code, raw)
	}

	// Старт 09:30 уже занят записью [09:30, 09:45).
	code, raw = postBooking(t, router, bookingRequest{
		EventTypeID: int64(shortID), StartsAt: tomorrowAt(9, 30), GuestName: "Вера", GuestEmail: "vera@example.com",
	})
	if code != http.StatusConflict {
		t.Fatalf("повтор слота: ожидался статус %d, получен %d, тело: %s", http.StatusConflict, code, raw)
	}
}

// TestBookingsLegacyStartStaysVisibleAndBlocksOverlap проверяет, что запись на
// прежней сетке (09:15) остаётся в списке предстоящих встреч и занимает своё
// время для пересекающихся интервалов: миграция и пересчёт не выполняются.
func TestBookingsLegacyStartStaysVisibleAndBlocksOverlap(t *testing.T) {
	router, db := newSeededRouter(t)
	legacyTypeID := insertEventType(t, db, 15)
	insertBooking(t, db, legacyTypeID, tomorrowAt(9, 15), "Анна", "anna@example.com", "")

	bookings := getUpcoming(t, router)
	if len(bookings) != 1 {
		t.Fatalf("ожидалась 1 предстоящая встреча, получено %d", len(bookings))
	}
	if got := bookings[0].StartsAt.Format("15:04"); got != "09:15" {
		t.Errorf("ожидалось начало 09:15, получено %s", got)
	}

	// [09:00, 09:30) типа на 30 минут перекрывает прежнюю запись [09:15, 09:30).
	longID := insertEventType(t, db, 30)
	code, raw := postBooking(t, router, bookingRequest{
		EventTypeID: int64(longID), StartsAt: tomorrowAt(9, 0), GuestName: "Борис", GuestEmail: "boris@example.com",
	})
	if code != http.StatusConflict {
		t.Fatalf("пересечение с прежней записью: ожидался статус %d, получен %d, тело: %s", http.StatusConflict, code, raw)
	}
}
