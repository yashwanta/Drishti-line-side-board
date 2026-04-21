package db

import (
	"database/sql"
	"fmt"
	"log"
	"os"

	_ "github.com/lib/pq"
)

var Pool *sql.DB

// Connect opens and validates the PostgreSQL connection pool.
func Connect() {
	dsn := fmt.Sprintf(
		"host=%s port=%s dbname=%s user=%s password=%s sslmode=disable",
		os.Getenv("DB_HOST"),
		os.Getenv("DB_PORT"),
		os.Getenv("DB_NAME"),
		os.Getenv("DB_USER"),
		os.Getenv("DB_PASS"),
	)

	var err error
	Pool, err = sql.Open("postgres", dsn)
	if err != nil {
		log.Fatalf("[db] sql.Open failed: %v", err)
	}
	Pool.SetMaxOpenConns(10)
	Pool.SetMaxIdleConns(3)

	if err = Pool.Ping(); err != nil {
		log.Fatalf("[db] ping failed: %v — check DB_HOST/PORT/NAME/USER/PASS in .env", err)
	}
	log.Printf("[db] connected to %s/%s as %s",
		os.Getenv("DB_HOST"), os.Getenv("DB_NAME"), os.Getenv("DB_USER"))
}
