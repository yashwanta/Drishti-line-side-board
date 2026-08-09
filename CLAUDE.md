# Plan: Standalone EXE + Shipping & Production Status Cards

## What
1. Bundle the dashboard (React SPA + mock API) into a single Windows `.exe` — no installation, no separate services
2. Add two new cards to `KPIStrip`: **Shipping Status** and **Production Status**

---

## Part A — Standalone Executable

### Approach: Embed React build into Go + merge mock API routes

A single Go binary will:
- Embed the built React app via `//go:embed`
- Serve it as static files on port 3001
- Handle all API routes the frontend needs (mock data)

**No CGO, no external dependencies, pure Go 1.21.** Result: one `.exe` file.

### Files to create/modify

| File | Change |
|------|--------|
| `exe/main.go` | New package — embeds `../frontend/build/` + all mock API handlers. Serves on `:3001` |
| `Makefile` | Add `make build-exe` target: builds React then compiles Go exe |

### Steps

1. **Update `frontend/vite.config.js`** — change `outDir` from `../backend-go/static` to `build` (relative to exe project root). This keeps exe build isolated.

2. **Create `exe/main.go`** that:
   - Uses `//go:embed build` to embed the React build
   - Registers all mock API handlers (from `seed/mock_server.go` + new shipping/mars handlers)
   - Serves the embedded SPA at `/` and API at `/api/*`
   - Serves on port 3001

3. **Add to `Makefile`:**
   ```
   build-exe:
       cd frontend && npm install && npm run build
       cd exe && go build -o ../lsb-dashboard.exe .
   ```

### Build output
- `lsb-dashboard.exe` — single self-contained exe (~10-15MB)
- Run it: double-click or `.\lsb-dashboard.exe`
- Dashboard at: `http://localhost:3001`

---

## Part B — Production Status Card

### What it shows (per station)
- **Status badge**: RUNNING / DOWNTIME / IDLE / SETUP
- **Parts produced** (actual vs plan for current hour or shift)
- **Efficiency %** with color coding (green ≥90%, yellow ≥75%, red <75%)
- **Current part** being produced
- **Cycle time** (current or average)

### Mock data (in `exe/main.go` / `seed/mock_server.go`)

```go
type ProductionStatus struct {
    ResourceID   string  `json:"resource_id"`
    Status       string  `json:"status"`       // running|downtime|idle/setup
    CurrentPart  string  `json:"current_part"`
    Planned      int     `json:"planned"`
    Actual       int     `json:"actual"`
    Efficiency   float64 `json:"efficiency_pct"`
    CycleTime    float64 `json:"cycle_time_sec"`
    NextUp       string  `json:"next_part"`     // next part in queue
    CycleCount   int     `json:"cycles_today"`
}
```

Add endpoint: `GET /api/production/status` → returns `[]ProductionStatus` for all stations.

### Frontend: `ProductionStatusCard.jsx`
- Renders a card with: station name, status badge (color-coded), actual/plan progress bar, efficiency %, current part
- Shares same grid layout as `StationsPanel`
- Placed in `KPIStrip` alongside the existing KPI tiles? Or new tab? **New dedicated card in KPIStrip.**

Actually — the production status is per-station. Best placement:
- **As a new tab** alongside the existing tabs (Stations, Production, etc.)
- **OR** as part of a new "Floor Status" dashboard view that combines shipping + production

Decision: Add as **new tab "🏭 Production Status"** that shows all stations in a grid with their production metrics (actual/plan, efficiency, status, cycle time, next part).

---

## Part C — Shipping Status Card

### What it shows (MARS ERP data)
The user wants all: parts shipped, shipment count, container/truck status, delivery tracking.

```go
type ShippingStatus struct {
    PartsShippedToday    int     `json:"parts_shipped_today"`
    ShipmentCount        int     `json:"shipment_count"`
    PendingTrucks        int     `json:"pending_trucks"`
    LoadedTrucks         int     `json:"loaded_trucks"`
    ShippingDockStatus   string  `json:"shipping_dock_status"`  // ACTIVE|IDLE|MAINTENANCE
    OnTimeRate           float64 `json:"on_time_rate_pct"`
    NextShipment         string  `json:"next_shipment"`         // "WO-XXXX · 14:00"
    DeliveryETA          string  `json:"delivery_eta"`
    CustomerDeliveries   []CustomerDelivery
}

type CustomerDelivery struct {
    WorkOrder    string  `json:"work_order"`
    Customer     string  `json:"customer"`
    PartNumber   string  `json:"part_number"`
    Qty          int     `json:"qty"`
    ShipBy       string  `json:"ship_by"`
    Status       string  `json:"status"`   // SHIPPED|IN_TRANSIT|PENDING|ONTIME|LATE
    DeliveryDate string  `json:"delivery_date"`
}
```

### Mock data

```go
var shippingStatus = ShippingStatus{
    PartsShippedToday:  1280,
    ShipmentCount:      3,
    PendingTrucks:      2,
    LoadedTrucks:       1,
    ShippingDockStatus: "ACTIVE",
    OnTimeRate:         94.7,
    NextShipment:       "WO-20240610-01 · 16:00",
    DeliveryETA:        "2026-06-11 08:00",
    CustomerDeliveries: []CustomerDelivery{
        {WorkOrder: "WO-20240610-01", Customer: "BMW AG Leipzig", PartNumber: "BMW1000D-360", Qty: 184, ShipBy: "16:00", Status: "IN_TRANSIT", DeliveryDate: "2026-06-11"},
        {WorkOrder: "WO-20240609-03", Customer: "BMW Group", PartNumber: "BMW2000E-180", Qty: 160, ShipBy: "14:00", Status: "ONTIME", DeliveryDate: "2026-06-10"},
        {WorkOrder: "WO-20240610-02", Customer: "BMW Dingolfing", PartNumber: "BMW1000D-360", Qty: 92, ShipBy: "20:00", Status: "PENDING", DeliveryDate: "2026-06-11"},
        {WorkOrder: "WO-20240608-02", Customer: "MINI Oxford", PartNumber: "BMW3000F-240", Qty: 140, ShipBy: "12:00", Status: "LATE", DeliveryDate: "2026-06-10"},
    },
}
```

### New endpoint
`GET /api/shipping/status` → returns `ShippingStatus`

### Frontend: `ShippingPanel.jsx`
New tab **"🚛 Shipping"** with:
- Top row: 4 KPI cards (Parts Shipped, Shipments, Trucks, On-Time Rate)
- Middle: Shipping dock status + next shipment ETA
- Bottom: Customer deliveries table with status badges

---

## Implementation Order

1. **Add mock data** to `seed/mock_server.go` (production status + shipping status endpoints)
2. **Rebuild mock server** and verify endpoints
3. **Update `KPIStrip`** — add inline Shipping and Production tiles (or add new tab, TBD)
4. **Create `ProductionStatusCard.jsx`** — show per-station production status in a tab
5. **Create `ShippingPanel.jsx`** — new Shipping tab
6. **Update `App.jsx`** — add new tabs, wire up new API calls
7. **Create `exe/main.go`** — embed Go server with all handlers + React build
8. **Update `Makefile`** — `make build-exe` target
9. **Build exe** and verify

---

## Files to touch

```
frontend/src/App.jsx                        ← add new tabs
frontend/src/components/KPIStrip.jsx        ← optional: add shipping/production tiles
frontend/src/components/ProductionStatusCard.jsx  ← new (or reuse StationsPanel)
frontend/src/components/ShippingPanel.jsx   ← new
seed/mock_server.go                         ← add shipping + production status mock data
exe/main.go                                 ← new (full standalone server)
Makefile                                    ← add build-exe target
frontend/vite.config.js                     ← update outDir for exe build
```
