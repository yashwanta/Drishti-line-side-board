# ── Build stage ───────────────────────────────────────────────────────────────
FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.mod go.sum* ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o lsb-api .

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM alpine:3.19
RUN apk --no-cache add ca-certificates curl tzdata
WORKDIR /app
COPY --from=builder /app/lsb-api .
# Optional: copy pre-built React static files
COPY --from=builder /app/static* ./static/
EXPOSE 3001
CMD ["./lsb-api"]
