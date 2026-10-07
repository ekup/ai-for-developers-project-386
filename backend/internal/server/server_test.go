package server

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

// TestHealthSmoke проверяет, что сервис поднимается и отвечает на /health.
func TestHealthSmoke(t *testing.T) {
	router := NewRouter(nil, "")
	srv := httptest.NewServer(router)
	defer srv.Close()

	resp, err := http.Get(srv.URL + "/health")
	if err != nil {
		t.Fatalf("запрос /health: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("ожидался статус %d, получен %d", http.StatusOK, resp.StatusCode)
	}

	var body map[string]string
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("декодировать ответ: %v", err)
	}

	if body["status"] != "ok" {
		t.Fatalf("ожидался status=ok, получено %q", body["status"])
	}
}

// TestStaticServing проверяет раздачу статики и SPA-fallback.
func TestStaticServing(t *testing.T) {
	dir := t.TempDir()

	if err := os.WriteFile(filepath.Join(dir, "index.html"), []byte("<!doctype html><h1>hello</h1>"), 0o644); err != nil {
		t.Fatalf("подготовить index.html: %v", err)
	}
	if err := os.WriteFile(filepath.Join(dir, "app.js"), []byte("console.log('hi')"), 0o644); err != nil {
		t.Fatalf("подготовить app.js: %v", err)
	}

	router := NewRouter(nil, dir)

	t.Run("существующий файл", func(t *testing.T) {
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/app.js", nil))

		if rec.Code != http.StatusOK {
			t.Fatalf("ожидался статус %d, получен %d", http.StatusOK, rec.Code)
		}
	})

	t.Run("SPA fallback отдаёт index.html", func(t *testing.T) {
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/some/client/route", nil))

		if rec.Code != http.StatusOK {
			t.Fatalf("ожидался статус %d, получен %d", http.StatusOK, rec.Code)
		}
		if got := rec.Body.String(); got != "<!doctype html><h1>hello</h1>" {
			t.Fatalf("ожидался index.html, получено %q", got)
		}
	})
}
