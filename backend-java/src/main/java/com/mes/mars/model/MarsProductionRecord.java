package com.mes.mars.model;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * A single hourly production record as stored in MARS.
 */
public class MarsProductionRecord {

    @JsonProperty("hour")
    private int hour;

    @JsonProperty("work_order")
    private String workOrder;

    @JsonProperty("part_number")
    private String partNumber;

    @JsonProperty("operation")
    private String operation;

    @JsonProperty("planned_qty")
    private int plannedQty;

    @JsonProperty("actual_qty")
    private int actualQty;

    @JsonProperty("scrap_qty")
    private int scrapQty;

    @JsonProperty("rework_qty")
    private int reworkQty;

    @JsonProperty("cycle_time_sec")
    private double cycleTimeSec;

    @JsonProperty("operator_id")
    private String operatorId;

    @JsonProperty("operator_name")
    private String operatorName;

    @JsonProperty("confirmed")
    private boolean confirmed;

    @JsonProperty("source")
    private final String source = "MARS";

    // ── Constructors ──────────────────────────────────────────────────────────
    public MarsProductionRecord() {}

    // ── Getters / Setters ─────────────────────────────────────────────────────
    public int getHour() { return hour; }
    public void setHour(int hour) { this.hour = hour; }

    public String getWorkOrder() { return workOrder; }
    public void setWorkOrder(String workOrder) { this.workOrder = workOrder; }

    public String getPartNumber() { return partNumber; }
    public void setPartNumber(String partNumber) { this.partNumber = partNumber; }

    public String getOperation() { return operation; }
    public void setOperation(String operation) { this.operation = operation; }

    public int getPlannedQty() { return plannedQty; }
    public void setPlannedQty(int plannedQty) { this.plannedQty = plannedQty; }

    public int getActualQty() { return actualQty; }
    public void setActualQty(int actualQty) { this.actualQty = actualQty; }

    public int getScrapQty() { return scrapQty; }
    public void setScrapQty(int scrapQty) { this.scrapQty = scrapQty; }

    public int getReworkQty() { return reworkQty; }
    public void setReworkQty(int reworkQty) { this.reworkQty = reworkQty; }

    public double getCycleTimeSec() { return cycleTimeSec; }
    public void setCycleTimeSec(double cycleTimeSec) { this.cycleTimeSec = cycleTimeSec; }

    public String getOperatorId() { return operatorId; }
    public void setOperatorId(String operatorId) { this.operatorId = operatorId; }

    public String getOperatorName() { return operatorName; }
    public void setOperatorName(String operatorName) { this.operatorName = operatorName; }

    public boolean isConfirmed() { return confirmed; }
    public void setConfirmed(boolean confirmed) { this.confirmed = confirmed; }

    public String getSource() { return source; }
}
