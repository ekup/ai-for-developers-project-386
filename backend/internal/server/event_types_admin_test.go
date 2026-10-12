package server

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/ekup/ai-for-developers-project-386/backend/internal/api"
)

// createEventTypeBody — тело запроса на создание типа события. Длительность
// без omitempty: нулевое значение должно доходить до сервера явно.
type createEventTypeBody struct {
	Name            string `json:"name"`
	Description     string `json:"description"`
	DurationMinutes int32  `json:"durationMinutes"`
}

// updateEventTypeBody — тело запроса на правку типа события.
type updateEventTypeBody struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

// postEventType отправляет POST /api/event-types и возвращает код и сырое тело.
func postEventType(t *testing.T, router http.Handler, body createEventTypeBody) (int, []byte) {
	t.Helper()

	payload, err := json.Marshal(body)
	if err != nil {
		t.Fatalf("сериализовать запрос: %v", err)
	}

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/event-types", bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(rec, req)

	return rec.Code, rec.Body.Bytes()
}

// patchEventType отправляет PATCH /api/event-types/{id}.
func patchEventType(t *testing.T, router http.Handler, id int32, body updateEventTypeBody) (int, []byte) {
	t.Helper()

	payload, err := json.Marshal(body)
	if err != nil {
		t.Fatalf("сериализовать запрос: %v", err)
	}

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPatch, pathEventType(id), bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(rec, req)

	return rec.Code, rec.Body.Bytes()
}

// deleteEventType отправляет DELETE /api/event-types/{id}.
func deleteEventType(t *testing.T, router http.Handler, id int32) int {
	t.Helper()

	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, httptest.NewRequest(http.MethodDelete, pathEventType(id), nil))

	return rec.Code
}

// pathEventType собирает путь к типу события по его идентификатору.
func pathEventType(id int32) string {
	return fmt.Sprintf("/api/event-types/%d", id)
}

// TestEventTypesCreateCreatesType проверяет, что валидный запрос создаёт тип с
// назначенным системой идентификатором и он сразу виден в гостевом списке.
func TestEventTypesCreateCreatesType(t *testing.T) {
	router, _ := newSeededRouter(t)

	code, raw := postEventType(t, router, createEventTypeBody{
		Name:            "Консультация",
		Description:     "Разбор задачи",
		DurationMinutes: 45,
	})
	if code != http.StatusCreated {
		t.Fatalf("ожидался статус %d, получен %d, тело: %s", http.StatusCreated, code, raw)
	}

	var created api.EventType
	if err := json.Unmarshal(raw, &created); err != nil {
		t.Fatalf("декодировать ответ: %v", err)
	}

	if created.Id == 0 {
		t.Error("система не назначила идентификатор типа события")
	}
	if created.Name != "Консультация" || created.Description != "Разбор задачи" {
		t.Errorf("в ответе неверные название/описание: %+v", created)
	}
	if created.DurationMinutes != 45 {
		t.Errorf("ожидалась длительность 45, получена %d", created.DurationMinutes)
	}

	found := false
	for _, et := range getEventTypes(t, router) {
		if et.Id == created.Id {
			found = true
			if et.Name != "Консультация" || et.DurationMinutes != 45 {
				t.Errorf("в списке тип отличается от созданного: %+v", et)
			}
		}
	}
	if !found {
		t.Error("созданный тип события не виден в гостевом списке")
	}
}

// TestEventTypesCreateValidatesInput проверяет 400 для пустого названия и
// неположительной длительности.
func TestEventTypesCreateValidatesInput(t *testing.T) {
	router, _ := newSeededRouter(t)

	cases := []struct {
		name string
		req  createEventTypeBody
	}{
		{name: "пустое название", req: createEventTypeBody{Description: "Описание", DurationMinutes: 15}},
		{name: "название из пробелов", req: createEventTypeBody{Name: "   ", DurationMinutes: 15}},
		{name: "нулевая длительность", req: createEventTypeBody{Name: "Звонок", DurationMinutes: 0}},
		{name: "отрицательная длительность", req: createEventTypeBody{Name: "Звонок", DurationMinutes: -5}},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			code, raw := postEventType(t, router, tc.req)
			if code != http.StatusBadRequest {
				t.Fatalf("ожидался статус %d, получен %d, тело: %s", http.StatusBadRequest, code, raw)
			}
		})
	}
}

// TestEventTypesUpdateEditsNameAndDescription проверяет, что правка меняет
// название и описание, сохраняет длительность и сразу видна в гостевом списке.
func TestEventTypesUpdateEditsNameAndDescription(t *testing.T) {
	router, db := newSeededRouter(t)
	id := insertEventType(t, db, 15)

	code, raw := patchEventType(t, router, id, updateEventTypeBody{
		Name:        "Обновлённый звонок",
		Description: "Новое описание",
	})
	if code != http.StatusOK {
		t.Fatalf("ожидался статус %d, получен %d, тело: %s", http.StatusOK, code, raw)
	}

	var updated api.EventType
	if err := json.Unmarshal(raw, &updated); err != nil {
		t.Fatalf("декодировать ответ: %v", err)
	}

	if updated.Id != id {
		t.Errorf("ожидался идентификатор %d, получен %d", id, updated.Id)
	}
	if updated.Name != "Обновлённый звонок" || updated.Description != "Новое описание" {
		t.Errorf("правка не применилась: %+v", updated)
	}
	if updated.DurationMinutes != 15 {
		t.Errorf("длительность не должна меняться: ожидалась 15, получена %d", updated.DurationMinutes)
	}

	for _, et := range getEventTypes(t, router) {
		if et.Id == id {
			if et.Name != "Обновлённый звонок" || et.Description != "Новое описание" {
				t.Errorf("в гостевом списке остались старые данные: %+v", et)
			}
			return
		}
	}
	t.Error("обновлённый тип события не найден в гостевом списке")
}

// TestEventTypesUpdateNotFound проверяет 404 для отсутствующего и мягко
// удалённого типа события.
func TestEventTypesUpdateNotFound(t *testing.T) {
	router, db := newSeededRouter(t)

	t.Run("отсутствующий тип", func(t *testing.T) {
		code, raw := patchEventType(t, router, 9999, updateEventTypeBody{Name: "Звонок"})
		if code != http.StatusNotFound {
			t.Fatalf("ожидался статус %d, получен %d, тело: %s", http.StatusNotFound, code, raw)
		}
	})

	t.Run("удалённый тип", func(t *testing.T) {
		id := insertEventType(t, db, 15)
		if _, err := db.Exec(`UPDATE event_types SET deleted_at = datetime('now') WHERE id = ?`, id); err != nil {
			t.Fatalf("мягко удалить тип события: %v", err)
		}

		code, raw := patchEventType(t, router, id, updateEventTypeBody{Name: "Звонок"})
		if code != http.StatusNotFound {
			t.Fatalf("ожидался статус %d, получен %d, тело: %s", http.StatusNotFound, code, raw)
		}
	})
}

// TestEventTypesRemoveSoftDeletes проверяет, что удаление убирает тип из
// гостевого списка, но сохраняет уже созданные записи этого типа.
func TestEventTypesRemoveSoftDeletes(t *testing.T) {
	router, db := newSeededRouter(t)
	id := insertEventType(t, db, 15)

	code, raw := postBooking(t, router, bookingRequest{
		EventTypeID: int64(id),
		StartsAt:    tomorrowAt(9, 0),
		GuestName:   "Анна",
		GuestEmail:  "anna@example.com",
	})
	if code != http.StatusCreated {
		t.Fatalf("подготовить запись: ожидался статус %d, получен %d, тело: %s", http.StatusCreated, code, raw)
	}

	if code := deleteEventType(t, router, id); code != http.StatusNoContent {
		t.Fatalf("ожидался статус %d, получен %d", http.StatusNoContent, code)
	}

	for _, et := range getEventTypes(t, router) {
		if et.Id == id {
			t.Fatalf("удалённый тип остался в гостевом списке: %+v", et)
		}
	}

	var bookings int
	if err := db.QueryRow(`SELECT COUNT(*) FROM bookings WHERE event_type_id = ?`, id).Scan(&bookings); err != nil {
		t.Fatalf("посчитать записи удалённого типа: %v", err)
	}
	if bookings != 1 {
		t.Fatalf("записи удалённого типа не сохранились: найдено %d", bookings)
	}
}

// TestEventTypesRemoveNotFound проверяет 404 для отсутствующего типа и
// повторного удаления уже удалённого.
func TestEventTypesRemoveNotFound(t *testing.T) {
	router, db := newSeededRouter(t)

	t.Run("отсутствующий тип", func(t *testing.T) {
		if code := deleteEventType(t, router, 9999); code != http.StatusNotFound {
			t.Fatalf("ожидался статус %d, получен %d", http.StatusNotFound, code)
		}
	})

	t.Run("повторное удаление", func(t *testing.T) {
		id := insertEventType(t, db, 15)
		if code := deleteEventType(t, router, id); code != http.StatusNoContent {
			t.Fatalf("первое удаление: ожидался статус %d, получен %d", http.StatusNoContent, code)
		}
		if code := deleteEventType(t, router, id); code != http.StatusNotFound {
			t.Fatalf("повторное удаление: ожидался статус %d, получен %d", http.StatusNotFound, code)
		}
	})
}
