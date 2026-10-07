// Package config загружает настройки приложения из переменных окружения.
package config

import "os"

// Config описывает конфигурацию бэкенда.
type Config struct {
	// Host — адрес, на котором слушает HTTP-сервер.
	Host string
	// Port — порт HTTP-сервера.
	Port string
	// DatabasePath — путь к файлу базы данных SQLite.
	DatabasePath string
	// StaticDir — каталог со собранной статикой фронтенда.
	// Если пустой, статика не раздаётся (удобно в тестах и при разработке).
	StaticDir string
}

// Load собирает конфигурацию из окружения, подставляя значения по умолчанию.
func Load() Config {
	return Config{
		Host:         env("HOST", "0.0.0.0"),
		Port:         env("PORT", "8080"),
		DatabasePath: env("DATABASE_PATH", "data/app.db"),
		StaticDir:    env("STATIC_DIR", "static"),
	}
}

// Addr возвращает адрес для http.Server.
func (c Config) Addr() string {
	return c.Host + ":" + c.Port
}

func env(key, fallback string) string {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		return v
	}
	return fallback
}
