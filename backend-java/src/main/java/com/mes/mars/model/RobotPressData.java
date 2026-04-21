package com.mes.mars.model;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Live + aggregated data from the robot air press pendant (REST/JSON endpoint).
 *
 * The pendant is polled every ROBOT_PRESS_POLL_MS milliseconds by RobotPressService.
 * This model holds the most recent snapshot served to the Go gateway.
 */
public class RobotPressData {

    // ── Live / last-cycle ─────────────────────────────────────────────────────

    /** Peak press force of the most recent cycle (kN) */
    @JsonProperty("peak_force_kn")
    private double peakForceKn;

    /** Pass / Fail for last cycle (force within tolerance band) */
    @JsonProperty("pass_fail")
    private String passFail;   // "PASS" | "FAIL" | "UNKNOWN"

    /** Lower tolerance limit (kN) — from config */
    @JsonProperty("force_min_kn")
    private double forceMinKn;

    /** Upper tolerance limit (kN) — from config */
    @JsonProperty("force_max_kn")
    private double forceMaxKn;

    /** Press program / recipe currently loaded */
    @JsonProperty("program")
    private String program;

    /** Current alarm / fault code; empty string = no alarm */
    @JsonProperty("alarm_code")
    private String alarmCode;

    /** Human-readable alarm description */
    @JsonProperty("alarm_desc")
    private String alarmDesc;

    // ── Today's aggregates (reset at shift start) ─────────────────────────────

    /** Total press cycles completed today */
    @JsonProperty("cycles_today")
    private int cyclesToday;

    /** How many of today's cycles passed */
    @JsonProperty("passes_today")
    private int passesToday;

    /** How many of today's cycles failed */
    @JsonProperty("fails_today")
    private int failsToday;

    /** Pass rate % today */
    @JsonProperty("pass_rate_pct")
    private double passRatePct;

    /** Min peak force observed today (kN) */
    @JsonProperty("min_force_today_kn")
    private double minForceTodayKn;

    /** Max peak force observed today (kN) */
    @JsonProperty("max_force_today_kn")
    private double maxForceTodayKn;

    /** Average peak force today (kN) */
    @JsonProperty("avg_force_today_kn")
    private double avgForceTodayKn;

    // ── Metadata ──────────────────────────────────────────────────────────────

    /** ISO-8601 timestamp of last successful poll */
    @JsonProperty("last_poll_ts")
    private String lastPollTs;

    /** true = last poll succeeded; false = pendant unreachable */
    @JsonProperty("pendant_online")
    private boolean pendantOnline;

    @JsonProperty("source")
    private final String source = "ROBOT_PRESS_PENDANT";

    // ── Constructors ──────────────────────────────────────────────────────────
    public RobotPressData() {
        this.passFail = "UNKNOWN";
        this.alarmCode = "";
        this.alarmDesc = "";
    }

    // ── Getters / Setters ─────────────────────────────────────────────────────
    public double getPeakForceKn() { return peakForceKn; }
    public void setPeakForceKn(double peakForceKn) { this.peakForceKn = peakForceKn; }

    public String getPassFail() { return passFail; }
    public void setPassFail(String passFail) { this.passFail = passFail; }

    public double getForceMinKn() { return forceMinKn; }
    public void setForceMinKn(double forceMinKn) { this.forceMinKn = forceMinKn; }

    public double getForceMaxKn() { return forceMaxKn; }
    public void setForceMaxKn(double forceMaxKn) { this.forceMaxKn = forceMaxKn; }

    public String getProgram() { return program; }
    public void setProgram(String program) { this.program = program; }

    public String getAlarmCode() { return alarmCode; }
    public void setAlarmCode(String alarmCode) { this.alarmCode = alarmCode; }

    public String getAlarmDesc() { return alarmDesc; }
    public void setAlarmDesc(String alarmDesc) { this.alarmDesc = alarmDesc; }

    public int getCyclesToday() { return cyclesToday; }
    public void setCyclesToday(int cyclesToday) { this.cyclesToday = cyclesToday; }

    public int getPassesToday() { return passesToday; }
    public void setPassesToday(int passesToday) { this.passesToday = passesToday; }

    public int getFailsToday() { return failsToday; }
    public void setFailsToday(int failsToday) { this.failsToday = failsToday; }

    public double getPassRatePct() { return passRatePct; }
    public void setPassRatePct(double passRatePct) { this.passRatePct = passRatePct; }

    public double getMinForceTodayKn() { return minForceTodayKn; }
    public void setMinForceTodayKn(double minForceTodayKn) { this.minForceTodayKn = minForceTodayKn; }

    public double getMaxForceTodayKn() { return maxForceTodayKn; }
    public void setMaxForceTodayKn(double maxForceTodayKn) { this.maxForceTodayKn = maxForceTodayKn; }

    public double getAvgForceTodayKn() { return avgForceTodayKn; }
    public void setAvgForceTodayKn(double avgForceTodayKn) { this.avgForceTodayKn = avgForceTodayKn; }

    public String getLastPollTs() { return lastPollTs; }
    public void setLastPollTs(String lastPollTs) { this.lastPollTs = lastPollTs; }

    public boolean isPendantOnline() { return pendantOnline; }
    public void setPendantOnline(boolean pendantOnline) { this.pendantOnline = pendantOnline; }

    public String getSource() { return source; }
}
