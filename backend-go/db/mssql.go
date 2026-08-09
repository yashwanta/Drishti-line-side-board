package db

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"os"
	"time"

	_ "github.com/microsoft/go-mssqldb"
)

// MSSQLPool is the shared MARS SQL Server connection pool.
var MSSQLPool *sql.DB

// ConnectMSSQL opens and validates the MARS SQL Server connection pool.
func ConnectMSSQL() error {
	connectionString := fmt.Sprintf(
		"sqlserver://%s:%s@%s:%s?database=%s&connection+timeout=30",
		os.Getenv("LSB_DB_USER"),
		os.Getenv("LSB_DB_PASSWORD"),
		os.Getenv("LSB_DB_SERVER"),
		os.Getenv("LSB_DB_PORT"),
		os.Getenv("LSB_DB_NAME"),
	)

	pool, err := sql.Open("sqlserver", connectionString)
	if err != nil {
		slog.Error("MSSQL connection open failed", "error", err)
		return fmt.Errorf("open MSSQL connection: %w", err)
	}
	pool.SetMaxOpenConns(10)
	pool.SetMaxIdleConns(3)
	pool.SetConnMaxLifetime(5 * time.Minute)

	if err := pool.Ping(); err != nil {
		_ = pool.Close()
		slog.Error("MSSQL connection ping failed", "error", err)
		return fmt.Errorf("ping MSSQL connection: %w", err)
	}

	MSSQLPool = pool
	slog.Info("MSSQL connection established",
		"server", os.Getenv("LSB_DB_SERVER"),
		"database", os.Getenv("LSB_DB_NAME"),
	)
	return nil
}

// CloseMSSQL closes the MARS SQL Server pool when it is open.
func CloseMSSQL() {
	if MSSQLPool == nil {
		return
	}
	if err := MSSQLPool.Close(); err != nil {
		slog.Warn("MSSQL connection close failed", "error", err)
	}
	MSSQLPool = nil
}

// MSSQLHealthy reports whether SQL Server responds within two seconds.
func MSSQLHealthy() bool {
	if MSSQLPool == nil {
		return false
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	return MSSQLPool.PingContext(ctx) == nil
}
