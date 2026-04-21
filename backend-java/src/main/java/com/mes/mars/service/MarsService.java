package com.mes.mars.service;

import com.mes.mars.model.MarsKpi;
import com.mes.mars.model.MarsProductionRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Queries the MARS SQL Server database for production KPIs, hourly production
 * records, quality data, and work order schedules.
 *
 * SQL queries use T-SQL syntax (SQL Server).
 *
 * ⚠️  Table/column names below are illustrative — adjust them in application.properties
 *     or by editing the queries here to match your actual MARS schema.
 *
 * The MARS schema assumed:
 *   dbo.ProductionLog   (ResourceID, ShiftNum, EventTS, WorkOrder, PartNumber,
 *                         Operation, GoodQty, ScrapQty, ReworkQty, CycleTimeSec,
 *                         OperatorID, OperatorName, Confirmed)
 *   dbo.QualityLog      (ResourceID, EventTS, DefectCode, Qty, Inspector)
 *   dbo.WorkOrderSched  (ResourceID, WorkOrder, PartNumber, Revision, PlannedQty,
 *                         ScheduledDate, ShiftNum)
 */
@Service
public class MarsService {

    private static final Logger log = LoggerFactory.getLogger(MarsService.class);

    @Autowired
    @Qualifier("marsJdbc")
    private JdbcTemplate marsJdbc;

    @Value("${plant.resource.id:WM15}")
    private String defaultResource;

    @Value("${plant.shift.num:2}")
    private int defaultShift;

    @Value("${plant.jph.target:23}")
    private int jphTarget;

    // ── KPIs ──────────────────────────────────────────────────────────────────

    public MarsKpi getKpis(String resource, int shift) {
        String today = LocalDate.now().toString();    // YYYY-MM-DD
        log.info("[mars] KPI query resource={} shift={} date={}", resource, shift, today);

        String sql = """
            SELECT
                COALESCE(SUM(pl.GoodQty),   0) AS actual_qty,
                COALESCE(SUM(pl.ScrapQty),  0) AS scrap_qty,
                COALESCE(SUM(pl.ReworkQty), 0) AS rework_qty,
                COALESCE(AVG(pl.CycleTimeSec), 0) AS avg_cycle,
                MAX(pl.WorkOrder)   AS work_order,
                MAX(pl.PartNumber)  AS part_number,
                MAX(pl.Revision)    AS revision
            FROM dbo.ProductionLog pl
            WHERE pl.ResourceID = ?
              AND pl.ShiftNum   = ?
              AND CAST(pl.EventTS AS DATE) = CAST(? AS DATE)
            """;

        String schedSql = """
            SELECT TOP 1 PlannedQty
            FROM dbo.WorkOrderSched
            WHERE ResourceID = ?
              AND ShiftNum   = ?
              AND CAST(ScheduledDate AS DATE) = CAST(? AS DATE)
            ORDER BY ScheduledDate DESC
            """;

        MarsKpi kpi = new MarsKpi();
        kpi.setResource(resource);
        kpi.setShift(shift);
        kpi.setDate(today);

        try {
            Map<String, Object> row = marsJdbc.queryForMap(sql, resource, shift, today);

            int actual  = toInt(row.get("actual_qty"));
            int scrap   = toInt(row.get("scrap_qty"));
            double cycle = toDouble(row.get("avg_cycle"));

            kpi.setActualQty(actual);
            kpi.setScrapQty(scrap);
            kpi.setWorkOrder(str(row.get("work_order")));
            kpi.setPartNumber(str(row.get("part_number")));
            kpi.setRevision(str(row.get("revision")));

            int total = actual + scrap;
            if (total > 0)
                kpi.setFpyPct(round2((double) actual / total * 100));

            // OEE (simplified) = (Actual / Plan) * FPY
            int plan = fetchPlan(schedSql, resource, shift, today);
            kpi.setPlannedQty(plan > 0 ? plan : jphTarget * 8);
            if (kpi.getPlannedQty() > 0)
                kpi.setOeePct(round2((double) actual / kpi.getPlannedQty() * kpi.getFpyPct() / 100));

        } catch (Exception ex) {
            log.error("[mars] KPI query failed: {}", ex.getMessage());
            kpi.setWorkOrder("N/A");
            kpi.setPartNumber("N/A");
        }

        return kpi;
    }

    // ── Hourly production records ─────────────────────────────────────────────

    public List<MarsProductionRecord> getProduction(String resource, int shift) {
        String today = LocalDate.now().toString();
        log.info("[mars] Production query resource={} shift={} date={}", resource, shift, today);

        String sql = """
            SELECT
                DATEPART(HOUR, EventTS)       AS hour,
                MAX(WorkOrder)                AS work_order,
                MAX(PartNumber)               AS part_number,
                MAX(Operation)                AS operation,
                COALESCE(SUM(GoodQty),   0)   AS actual_qty,
                COALESCE(SUM(ScrapQty),  0)   AS scrap_qty,
                COALESCE(SUM(ReworkQty), 0)   AS rework_qty,
                COALESCE(AVG(CycleTimeSec),0) AS cycle_time,
                MAX(OperatorID)               AS operator_id,
                MAX(OperatorName)             AS operator_name,
                MAX(CAST(Confirmed AS INT))   AS confirmed
            FROM dbo.ProductionLog
            WHERE ResourceID = ?
              AND ShiftNum   = ?
              AND CAST(EventTS AS DATE) = CAST(? AS DATE)
            GROUP BY DATEPART(HOUR, EventTS)
            ORDER BY hour
            """;

        List<MarsProductionRecord> result = new ArrayList<>();
        try {
            List<Map<String, Object>> rows = marsJdbc.queryForList(sql, resource, shift, today);
            for (Map<String, Object> row : rows) {
                MarsProductionRecord rec = new MarsProductionRecord();
                rec.setHour(toInt(row.get("hour")));
                rec.setWorkOrder(str(row.get("work_order")));
                rec.setPartNumber(str(row.get("part_number")));
                rec.setOperation(str(row.get("operation")));
                rec.setPlannedQty(jphTarget);
                rec.setActualQty(toInt(row.get("actual_qty")));
                rec.setScrapQty(toInt(row.get("scrap_qty")));
                rec.setReworkQty(toInt(row.get("rework_qty")));
                rec.setCycleTimeSec(toDouble(row.get("cycle_time")));
                rec.setOperatorId(str(row.get("operator_id")));
                rec.setOperatorName(str(row.get("operator_name")));
                rec.setConfirmed(toInt(row.get("confirmed")) == 1);
                result.add(rec);
            }
        } catch (Exception ex) {
            log.error("[mars] Production query failed: {}", ex.getMessage());
        }
        return result;
    }

    // ── Quality data ──────────────────────────────────────────────────────────

    public List<Map<String, Object>> getQuality(String resource) {
        String today = LocalDate.now().toString();
        String sql = """
            SELECT
                DefectCode,
                COUNT(*)   AS count,
                SUM(Qty)   AS total_qty,
                MAX(Inspector) AS last_inspector,
                MAX(CAST(EventTS AS NVARCHAR(30))) AS last_ts
            FROM dbo.QualityLog
            WHERE ResourceID = ?
              AND CAST(EventTS AS DATE) = CAST(? AS DATE)
            GROUP BY DefectCode
            ORDER BY total_qty DESC
            """;
        try {
            return marsJdbc.queryForList(sql, resource, today);
        } catch (Exception ex) {
            log.error("[mars] Quality query failed: {}", ex.getMessage());
            return List.of();
        }
    }

    // ── Schedule ──────────────────────────────────────────────────────────────

    public List<Map<String, Object>> getSchedule(String resource) {
        String today = LocalDate.now().toString();
        String sql = """
            SELECT TOP 10
                WorkOrder, PartNumber, Revision, PlannedQty, ShiftNum,
                CAST(ScheduledDate AS NVARCHAR(30)) AS scheduled_date
            FROM dbo.WorkOrderSched
            WHERE ResourceID = ?
              AND CAST(ScheduledDate AS DATE) >= CAST(? AS DATE)
            ORDER BY ScheduledDate ASC
            """;
        try {
            return marsJdbc.queryForList(sql, resource, today);
        } catch (Exception ex) {
            log.error("[mars] Schedule query failed: {}", ex.getMessage());
            return List.of();
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private int fetchPlan(String sql, Object... args) {
        try {
            Integer p = marsJdbc.queryForObject(sql, Integer.class, args);
            return p != null ? p : 0;
        } catch (Exception ex) {
            return 0;
        }
    }

    private int toInt(Object v) {
        if (v == null) return 0;
        if (v instanceof Number) return ((Number) v).intValue();
        try { return Integer.parseInt(v.toString().trim()); } catch (Exception e) { return 0; }
    }

    private double toDouble(Object v) {
        if (v == null) return 0.0;
        if (v instanceof Number) return ((Number) v).doubleValue();
        try { return Double.parseDouble(v.toString().trim()); } catch (Exception e) { return 0.0; }
    }

    private String str(Object v) {
        return v == null ? "" : v.toString().trim();
    }

    private double round2(double v) {
        return BigDecimal.valueOf(v).setScale(2, RoundingMode.HALF_UP).doubleValue();
    }
}
