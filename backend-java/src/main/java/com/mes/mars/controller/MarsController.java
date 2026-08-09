package com.mes.mars.controller;

import com.mes.mars.model.MarsKpi;
import com.mes.mars.model.MarsProductionRecord;
import com.mes.mars.service.MarsService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * REST controller exposing MARS SQL Server data to the Go API gateway.
 * All endpoints are under /mars/*.
 *
 * Called by:
 *   Go handler handlers/mars.go  →  proxyToJava(w, r, "/mars/kpis")  etc.
 */
@RestController
@RequestMapping("/mars")
public class MarsController {

    private static final Logger log = LoggerFactory.getLogger(MarsController.class);

    @Autowired
    private MarsService marsService;

    @Autowired
    @Qualifier("marsJdbc")
    private JdbcTemplate marsJdbc;

    @Value("${plant.resource.id:WM15}")
    private String defaultResource;

    @Value("${plant.shift.num:2}")
    private int defaultShift;

    @Value("${plant.jph.target:23}")
    private int jphTarget;

    // ── GET /mars/kpis?resource=WM15&shift=2 ─────────────────────────────────
    @GetMapping("/kpis")
    public ResponseEntity<MarsKpi> getKpis(
            @RequestParam(value = "resource", required = false) String resource,
            @RequestParam(value = "shift",    required = false) Integer shift) {

        String res = resource != null ? resource : defaultResource;
        int sh  = shift    != null ? shift    : defaultShift;

        MarsKpi kpi = marsService.getKpis(res, sh);
        return ResponseEntity.ok(kpi);
    }

    // ── GET /mars/production?resource=WM15&shift=2 ───────────────────────────
    @GetMapping("/production")
    public ResponseEntity<List<MarsProductionRecord>> getProduction(
            @RequestParam(value = "resource", required = false) String resource,
            @RequestParam(value = "shift",    required = false) Integer shift) {

        String res = resource != null ? resource : defaultResource;
        int sh  = shift    != null ? shift    : defaultShift;

        List<MarsProductionRecord> records = marsService.getProduction(res, sh);
        return ResponseEntity.ok(records);
    }

    // ── GET /mars/quality?resource=WM15 ──────────────────────────────────────
    @GetMapping("/quality")
    public ResponseEntity<List<Map<String, Object>>> getQuality(
            @RequestParam(value = "resource", required = false) String resource) {

        String res = resource != null ? resource : defaultResource;
        return ResponseEntity.ok(marsService.getQuality(res));
    }

    // ── GET /mars/schedule?resource=WM15 ─────────────────────────────────────
    @GetMapping("/schedule")
    public ResponseEntity<List<Map<String, Object>>> getSchedule(
            @RequestParam(value = "resource", required = false) String resource) {

        String res = resource != null ? resource : defaultResource;
        return ResponseEntity.ok(marsService.getSchedule(res));
    }

    // ── GET /mars/health ──────────────────────────────────────────────────────
    @GetMapping("/stations")
    public ResponseEntity<List<Map<String, Object>>> getStations(
            @RequestParam(value = "resource", required = false) String resource,
            @RequestParam(value = "date", required = false) String date) {

        String res = resolvedResource(resource);
        LocalDate selectedDate = resolvedDate(date);
        int target = jphTarget * 8;
        String sql = """
            SELECT ResourceID AS resource_id,
                   COALESCE(MAX(PartNumber), '') AS part_number,
                   CASE WHEN COALESCE(SUM(GoodQty), 0) > 0 THEN 'RUNNING' ELSE 'IDLE' END AS status,
                   CASE WHEN ? > 0 THEN CAST(COALESCE(SUM(GoodQty), 0) * 100.0 / ? AS DECIMAL(8,2)) ELSE 0 END AS efficiency_pct,
                   COALESCE(SUM(GoodQty), 0) AS actual,
                   ? AS target,
                   COALESCE(MAX(ShiftNum), ?) AS shift,
                   COALESCE(MAX(OperatorName), '') AS operator
            FROM dbo.ProductionLog
            WHERE ResourceID = ? AND CAST(EventTS AS DATE) = CAST(? AS DATE)
            GROUP BY ResourceID
            """;
        try {
            List<Map<String, Object>> rows = marsJdbc.queryForList(
                sql, target, target, target, defaultShift, res, selectedDate.toString());
            if (!rows.isEmpty()) {
                return ResponseEntity.ok(rows);
            }
        } catch (Exception ex) {
            log.error("[mars] Stations query failed: {}", ex.getMessage());
        }
        return ResponseEntity.ok(List.of(Map.of(
            "resource_id", res,
            "part_number", "",
            "status", "IDLE",
            "efficiency_pct", 0.0,
            "actual", 0,
            "target", target,
            "shift", defaultShift,
            "operator", ""
        )));
    }

    @GetMapping("/production/status")
    public ResponseEntity<List<Map<String, Object>>> getProductionStatus(
            @RequestParam(value = "resource", required = false) String resource,
            @RequestParam(value = "date", required = false) String date) {

        String res = resolvedResource(resource);
        LocalDate selectedDate = resolvedDate(date);
        int planned = jphTarget * 8;
        String sql = """
            SELECT ResourceID AS resource_id,
                   CASE WHEN COALESCE(SUM(GoodQty), 0) > 0 THEN 'running' ELSE 'idle' END AS status,
                   COALESCE(MAX(PartNumber), '') AS current_part,
                   ? AS planned,
                   COALESCE(SUM(GoodQty), 0) AS actual,
                   CASE WHEN ? > 0 THEN CAST(COALESCE(SUM(GoodQty), 0) * 100.0 / ? AS DECIMAL(8,2)) ELSE 0 END AS efficiency_pct,
                   COALESCE(AVG(CycleTimeSec), 0) AS cycle_time_sec
            FROM dbo.ProductionLog
            WHERE ResourceID = ? AND CAST(EventTS AS DATE) = CAST(? AS DATE)
            GROUP BY ResourceID
            """;
        try {
            List<Map<String, Object>> rows = marsJdbc.queryForList(
                sql, planned, planned, planned, res, selectedDate.toString());
            if (!rows.isEmpty()) {
                return ResponseEntity.ok(rows);
            }
        } catch (Exception ex) {
            log.error("[mars] Production status query failed: {}", ex.getMessage());
        }
        return ResponseEntity.ok(List.of(Map.of(
            "resource_id", res,
            "status", "idle",
            "current_part", "",
            "planned", planned,
            "actual", 0,
            "efficiency_pct", 0.0,
            "cycle_time_sec", 0.0
        )));
    }

    @GetMapping("/shipping/status")
    public ResponseEntity<Map<String, Object>> getShippingStatus(
            @RequestParam(value = "resource", required = false) String resource,
            @RequestParam(value = "date", required = false) String date) {

        String res = resolvedResource(resource);
        LocalDate selectedDate = resolvedDate(date);
        String summarySql = """
            -- TODO: replace with actual MARS table name
            SELECT COALESCE(SUM(PartQty), 0) AS parts_shipped_today,
                   COUNT(DISTINCT ShipmentID) AS shipment_count,
                   COALESCE(SUM(CASE WHEN TruckStatus = 'PENDING' THEN 1 ELSE 0 END), 0) AS pending_trucks,
                   COALESCE(SUM(CASE WHEN TruckStatus = 'LOADED' THEN 1 ELSE 0 END), 0) AS loaded_trucks,
                   COALESCE(MAX(DockStatus), 'IDLE') AS shipping_dock_status,
                   COALESCE(AVG(CASE WHEN OnTime = 1 THEN 100.0 ELSE 0.0 END), 0) AS on_time_rate_pct,
                   COALESCE(MIN(NextShipment), '') AS next_shipment,
                   COALESCE(MIN(DeliveryETA), '') AS delivery_eta
            FROM dbo.ShippingLog
            WHERE ResourceID = ? AND CAST(ShipDate AS DATE) = CAST(? AS DATE)
            """;
        String deliveriesSql = """
            -- TODO: replace with actual MARS table name
            SELECT WorkOrder AS work_order, Customer AS customer, PartNumber AS part_number,
                   Qty AS qty, ShipBy AS ship_by, Status AS status, DeliveryDate AS delivery_date
            FROM dbo.ShippingLog
            WHERE ResourceID = ? AND CAST(ShipDate AS DATE) = CAST(? AS DATE)
            ORDER BY ShipBy
            """;
        try {
            Map<String, Object> result = new LinkedHashMap<>(
                marsJdbc.queryForMap(summarySql, res, selectedDate.toString()));
            result.put("customer_deliveries", marsJdbc.queryForList(deliveriesSql, res, selectedDate.toString()));
            return ResponseEntity.ok(result);
        } catch (Exception ex) {
            log.error("[mars] Shipping status query failed: {}", ex.getMessage());
        }
        Map<String, Object> fallback = new LinkedHashMap<>();
        fallback.put("parts_shipped_today", 0);
        fallback.put("shipment_count", 0);
        fallback.put("pending_trucks", 0);
        fallback.put("loaded_trucks", 0);
        fallback.put("shipping_dock_status", "IDLE");
        fallback.put("on_time_rate_pct", 0.0);
        fallback.put("next_shipment", "");
        fallback.put("delivery_eta", "");
        fallback.put("customer_deliveries", List.of(Map.of(
            "work_order", "",
            "customer", "",
            "part_number", "",
            "qty", 0,
            "ship_by", "",
            "status", "PENDING",
            "delivery_date", selectedDate.toString()
        )));
        return ResponseEntity.ok(fallback);
    }

    @GetMapping("/weekly")
    public ResponseEntity<Map<String, Object>> getWeekly(
            @RequestParam(value = "resource", required = false) String resource,
            @RequestParam(value = "date", required = false) String date) {

        String res = resolvedResource(resource);
        LocalDate selectedDate = resolvedDate(date);
        LocalDate monday = selectedDate.with(DayOfWeek.MONDAY);
        LocalDate sunday = monday.plusDays(6);
        String sql = """
            SELECT CAST(EventTS AS DATE) AS production_date,
                   COALESCE(SUM(GoodQty), 0) AS actual,
                   COALESCE(SUM(GoodQty), 0) AS good_count,
                   COALESCE(SUM(ScrapQty), 0) AS scrap_count
            FROM dbo.ProductionLog
            WHERE ResourceID = ? AND CAST(EventTS AS DATE) BETWEEN CAST(? AS DATE) AND CAST(? AS DATE)
            GROUP BY CAST(EventTS AS DATE)
            ORDER BY production_date
            """;
        Map<String, Map<String, Object>> rowsByDate = new HashMap<>();
        try {
            for (Map<String, Object> row : marsJdbc.queryForList(
                    sql, res, monday.toString(), sunday.toString())) {
                rowsByDate.put(String.valueOf(row.get("production_date")), row);
            }
        } catch (Exception ex) {
            log.error("[mars] Weekly query failed: {}", ex.getMessage());
        }

        int plan = jphTarget * 8;
        List<Map<String, Object>> days = new ArrayList<>();
        for (int offset = 0; offset < 7; offset++) {
            LocalDate day = monday.plusDays(offset);
            Map<String, Object> row = rowsByDate.get(day.toString());
            int actual = row == null ? 0 : number(row.get("actual"));
            int good = row == null ? 0 : number(row.get("good_count"));
            int scrap = row == null ? 0 : number(row.get("scrap_count"));
            double efficiency = plan == 0 ? 0.0 : Math.round(actual * 1000.0 / plan) / 10.0;
            Map<String, Object> dayResult = new LinkedHashMap<>();
            dayResult.put("date", day.toString());
            dayResult.put("day", titleCase(day.getDayOfWeek().name()));
            dayResult.put("plan", plan);
            dayResult.put("actual", actual);
            dayResult.put("good_count", good);
            dayResult.put("scrap_count", scrap);
            dayResult.put("efficiency_pct", efficiency);
            dayResult.put("downtime_mins", 0);
            dayResult.put("shipments", 0);
            dayResult.put("parts_shipped", 0);
            days.add(dayResult);
        }
        return ResponseEntity.ok(Map.of("resource", res, "days", days));
    }

    @GetMapping("/downtime")
    public ResponseEntity<Map<String, Object>> getDowntime(
            @RequestParam(value = "resource", required = false) String resource,
            @RequestParam(value = "date", required = false) String date) {

        String res = resolvedResource(resource);
        LocalDate selectedDate = resolvedDate(date);
        String sql = """
            -- TODO: replace with actual MARS table name
            SELECT ID AS id, ResourceID AS resource, ReasonCode AS reason_code,
                   DATEDIFF(MINUTE, StartTS, COALESCE(EndTS, GETDATE())) AS minutes,
                   COALESCE(Comment, '') AS comment, StartTS AS start_ts,
                   COALESCE(LoggedBy, '') AS logged_by
            FROM dbo.DowntimeLog
            WHERE ResourceID = ? AND CAST(StartTS AS DATE) = CAST(? AS DATE)
            ORDER BY StartTS DESC
            """;
        List<Map<String, Object>> events;
        try {
            events = marsJdbc.queryForList(sql, res, selectedDate.toString());
        } catch (Exception ex) {
            log.error("[mars] Downtime query failed: {}", ex.getMessage());
            events = List.of(Map.of(
                "id", 0,
                "resource", res,
                "reason_code", "",
                "minutes", 0,
                "comment", "",
                "start_ts", selectedDate.atStartOfDay().toString(),
                "logged_by", ""
            ));
        }
        int totalMinutes = events.stream().mapToInt(event -> number(event.get("minutes"))).sum();
        return ResponseEntity.ok(Map.of(
            "events", events,
            "total_mins", totalMinutes,
            "resource", res,
            "date", selectedDate.toString()
        ));
    }

    private String resolvedResource(String resource) {
        return resource == null || resource.isBlank() ? defaultResource : resource.trim();
    }

    private LocalDate resolvedDate(String date) {
        if (date == null || date.isBlank()) {
            return LocalDate.now();
        }
        try {
            return LocalDate.parse(date.trim());
        } catch (Exception ignored) {
            return LocalDate.now();
        }
    }

    private int number(Object value) {
        if (value instanceof Number number) {
            return number.intValue();
        }
        try {
            return Integer.parseInt(String.valueOf(value));
        } catch (Exception ignored) {
            return 0;
        }
    }

    private String titleCase(String value) {
        return value.substring(0, 1) + value.substring(1).toLowerCase();
    }

    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok(Map.of(
            "status", "ok",
            "service", "mars-service",
            "database", "MARS SQL Server"
        ));
    }
}
