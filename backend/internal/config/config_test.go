package config

import "testing"

func TestLoadDefaults(t *testing.T) {
	t.Setenv("HOST", "")
	t.Setenv("PORT", "")
	t.Setenv("DATABASE_PATH", "")
	t.Setenv("STATIC_DIR", "")

	cfg := Load()

	if cfg.Host != "0.0.0.0" {
		t.Errorf("ожидался Host=0.0.0.0, получено %q", cfg.Host)
	}
	if cfg.Port != "8080" {
		t.Errorf("ожидался Port=8080, получено %q", cfg.Port)
	}
	if cfg.Addr() != "0.0.0.0:8080" {
		t.Errorf("ожидался Addr=0.0.0.0:8080, получено %q", cfg.Addr())
	}
}

func TestLoadFromEnv(t *testing.T) {
	t.Setenv("HOST", "127.0.0.1")
	t.Setenv("PORT", "9090")
	t.Setenv("DATABASE_PATH", "test.db")
	t.Setenv("STATIC_DIR", "public")

	cfg := Load()

	if cfg.Addr() != "127.0.0.1:9090" {
		t.Errorf("ожидался Addr=127.0.0.1:9090, получено %q", cfg.Addr())
	}
	if cfg.DatabasePath != "test.db" {
		t.Errorf("ожидался DatabasePath=test.db, получено %q", cfg.DatabasePath)
	}
	if cfg.StaticDir != "public" {
		t.Errorf("ожидался StaticDir=public, получено %q", cfg.StaticDir)
	}
}
