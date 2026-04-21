package com.mes.mars.model;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Top-level KPI aggregates pulled from the MARS SQL Server database.
 * These complement the PostgreSQL-backed KPIs shown on the Line Side Board
 * with authoritative ERP / planning data.
 */
public class MarsKpi {

    @JsonProperty("resource")
    private String resource;

    @JsonProperty("shift")
    private int shift;

    @JsonProperty("date")
    private String date;

    /** Planned quantity from MARS work order / schedule */
    @JsonProperty("planned_qty")
    private int plannedQty;

    /** Actual reported good parts (MARS confirmed) */
    @JsonProperty("actual_qty")
    private int actualQty;

    /** Scrap qty per MARS quality records */
    @JsonProperty("scrap_qty")
    private int scrapQty;

    /** First-pass yield % per MARS */
    @JsonProperty("fpy_pct")
    private double fpyPct;

    /** OEE % from MARS (0–100) */
    @JsonProperty("oee_pct")
    private double oeePct;

    /** Current work order number from MARS */
    @JsonProperty("work_order")
    private String workOrder;

    /** Part number active in MARS */
    @JsonProperty("part_number")
    private String partNumber;

    /** Material / BOM revision */
    @JsonProperty("revision")
    private String revision;

    @JsonProperty("source")
    private final String source = "MARS";

    // ── Constructors ──────────────────────────────────────────────────────────
    public MarsKpi() {}

    // ── Getters / Setters ─────────────────────────────────────────────────────
    public String getResource() { return resource; }
    public void setResource(String resource) { this.resource = resource; }

    public int getShift() { return shift; }
    public void setShift(int shift) { this.shift = shift; }

    public String getDate() { return date; }
    public void setDate(String date) { this.date = date; }

    public int getPlannedQty() { return plannedQty; }
    public void setPlannedQty(int plannedQty) { this.plannedQty = plannedQty; }

    public int getActualQty() { return actualQty; }
    public void setActualQty(int actualQty) { this.actualQty = actualQty; }

    public int getScrapQty() { return scrapQty; }
    public void setScrapQty(int scrapQty) { this.scrapQty = scrapQty; }

    public double getFpyPct() { return fpyPct; }
    public void setFpyPct(double fpyPct) { this.fpyPct = fpyPct; }

    public double getOeePct() { return oeePct; }
    public void setOeePct(double oeePct) { this.oeePct = oeePct; }

    public String getWorkOrder() { return workOrder; }
    public void setWorkOrder(String workOrder) { this.workOrder = workOrder; }

    public String getPartNumber() { return partNumber; }
    public void setPartNumber(String partNumber) { this.partNumber = partNumber; }

    public String getRevision() { return revision; }
    public void setRevision(String revision) { this.revision = revision; }

    public String getSource() { return source; }
}
