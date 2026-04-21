package middleware

import (
	"net"
	"net/http"
	"os"
	"strings"
)

// CORS enforces plant-subnet origin restriction and sets CORS headers.
func CORS(next http.Handler) http.Handler {
	subnet := os.Getenv("CORS_SUBNET") // e.g. "192.168.1.0/24"
	_, plantNet, _ := net.ParseCIDR(subnet)

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin != "" && plantNet != nil {
			// strip port
			host := origin
			if idx := strings.LastIndex(origin, ":"); idx > strings.Index(origin, "//") {
				host = origin[:idx]
			}
			host = strings.TrimPrefix(host, "http://")
			host = strings.TrimPrefix(host, "https://")
			ip := net.ParseIP(host)
			if ip != nil && plantNet.Contains(ip) {
				w.Header().Set("Access-Control-Allow-Origin", origin)
			}
		} else {
			// dev fallback — allow localhost
			w.Header().Set("Access-Control-Allow-Origin", "*")
		}

		w.Header().Set("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type,Authorization")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}
