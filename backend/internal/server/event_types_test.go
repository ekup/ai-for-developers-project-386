package server

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/ekup/ai-for-developers-project-386/backend/internal/api"
	"github.com/ekup/ai-for-developers-project-386/backend/internal/store"
)

// newSeededRouter поднимает роутер на реальной SQLite во временном каталоге,
// применяет схему и засевает типы событий — тем же путём, что и `cmd/server`.
func newSeededRouter(t *testing.T) (http.Handler, *sql.DB) {
	t.Helper()

	db, err := store.Open(filepath.Join(t.TempDir(), "app.db"))
	if err != nil {
		t.Fatalf("открыть БД: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })

	ctx := context.Background()
	if err := store.Migrate(ctx, db); err != nil {
		t.Fatalf("применить схему: %v", err)
	}
	if err := store.SeedEventTypes(ctx, db); err != nil {
		t.Fatalf("засеять типы событий: %v", err)
	}

	return NewRouter(db, ""), db
}

// getEventTypes запрашивает список активных типов событий по HTTP.
func getEventTypes(t *testing.T, router http.Handler) []api.EventType {
	t.Helper()

	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/event-types", nil))

	if rec.Code != http.StatusOK {
		t.Fatalf("ожидался статус %d, получен %d", http.StatusOK, rec.Code)
	}

	var types []api.EventType
	if err := json.NewDecoder(rec.Body).Decode(&types); err != nil {
		t.Fatalf("декодировать ответ: %v", err)
	}

	return types
}

// TestEventTypesListReturnsSeedTypes проверяет, что при старте создаются
// два seed-типа на 15 и 30 минут и они видны гостю через API.
func TestEventTypesListReturnsSeedTypes(t *testing.T) {
	router, _ := newSeededRouter(t)

	types := getEventTypes(t, router)

	if len(types) != 2 {
		t.Fatalf("ожидалось 2 seed-типа, получено %d", len(types))
	}

	byDuration := map[int32]api.EventType{}
	for _, et := range types {
		byDuration[et.DurationMinutes] = et
	}

	for _, want := range []int32{15, 30} {
		et, ok := byDuration[want]
		if !ok {
			t.Fatalf("нет seed-типа с длительностью %d минут", want)
		}
		if et.Id == 0 {
			t.Errorf("у типа события с длительностью %d не задан идентификатор", want)
		}
		if et.Name == "" {
			t.Errorf("у типа события с длительностью %d пустое название", want)
		}
		if et.Description == "" {
			t.Errorf("у типа события с длительностью %d пустое описание", want)
		}
	}
}

// TestSeedEventTypesIsIdempotent проверяет, что повторный запуск не создаёт
// дубликаты seed-типов.
func TestSeedEventTypesIsIdempotent(t *testing.T) {
	router, db := newSeededRouter(t)

	if err := store.SeedEventTypes(context.Background(), db); err != nil {
		t.Fatalf("повторный посев: %v", err)
	}

	if types := getEventTypes(t, router); len(types) != 2 {
		t.Fatalf("после повторного посева ожидалось 2 типа, получено %d", len(types))
	}
}
