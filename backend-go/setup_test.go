package main

import (
	"strings"
	"testing"
)

func TestOdbcConnection(t *testing.T) {
	connection := odbcConnection(setupDBConfig{
		Server:   "dbhost",
		Port:     1433,
		Database: "MARS",
		Username: "sa",
		Password: "secret",
	})

	for _, expected := range []string{
		"SERVER=dbhost,1433",
		"DATABASE={MARS}",
		"UID={sa}",
		"PWD={secret}",
	} {
		if !strings.Contains(connection, expected) {
			t.Errorf("odbcConnection() = %q, expected it to contain %q", connection, expected)
		}
	}
}

func TestTextHelper(t *testing.T) {
	tests := []struct {
		name  string
		input any
		want  string
	}{
		{name: "nil", input: nil, want: ""},
		{name: "string", input: "hello", want: "hello"},
		{name: "integer", input: 42, want: "42"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := text(test.input); got != test.want {
				t.Errorf("text(%v) = %q, want %q", test.input, got, test.want)
			}
		})
	}
}

func TestIntegerHelper(t *testing.T) {
	tests := []struct {
		name  string
		input any
		want  int
	}{
		{name: "integer string", input: "42", want: 42},
		{name: "whitespace", input: "  7  ", want: 7},
		{name: "invalid", input: "bad", want: 0},
		{name: "nil", input: nil, want: 0},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := integer(test.input); got != test.want {
				t.Errorf("integer(%v) = %d, want %d", test.input, got, test.want)
			}
		})
	}
}

func TestDecimalHelper(t *testing.T) {
	tests := []struct {
		name  string
		input any
		want  float64
	}{
		{name: "decimal string", input: "3.14", want: 3.14},
		{name: "empty", input: "", want: 0},
		{name: "nil", input: nil, want: 0},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := decimal(test.input); got != test.want {
				t.Errorf("decimal(%v) = %v, want %v", test.input, got, test.want)
			}
		})
	}
}
