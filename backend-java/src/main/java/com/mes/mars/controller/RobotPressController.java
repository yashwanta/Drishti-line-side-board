package com.mes.mars.controller;

import com.mes.mars.model.RobotPressData;
import com.mes.mars.service.RobotPressService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * REST controller exposing robot air press pendant data to the Go API gateway.
 * All endpoints are under /robotpress/*.
 *
 * Called by:
 *   Go handler handlers/robotpress.go  →  proxyToJava via /robotpress/status
 */
@RestController
@RequestMapping("/robotpress")
public class RobotPressController {

    @Autowired
    private RobotPressService robotPressService;

    // ── GET /robotpress/status ───────────────────────────────────────────────
    /**
     * Returns the latest cached robot press snapshot (updated every poll interval).
     * Contains: peak_force_kn, pass_fail, cycles_today, passes_today, fails_today,
     *           pass_rate_pct, alarm_code, alarm_desc, pendant_online, last_poll_ts.
     */
    @GetMapping("/status")
    public ResponseEntity<RobotPressData> getStatus() {
        return ResponseEntity.ok(robotPressService.getLatest());
    }

    // ── GET /robotpress/history?limit=50 ─────────────────────────────────────
    /**
     * Returns the last N press cycle history entries as a list of strings.
     * Each entry: "<ISO-8601-ts> | <force> kN | PASS|FAIL"
     */
    @GetMapping("/history")
    public ResponseEntity<Map<String, Object>> getHistory(
            @RequestParam(value = "limit", defaultValue = "50") int limit) {

        List<String> entries = robotPressService.getHistory(Math.min(limit, 200));
        return ResponseEntity.ok(Map.of(
            "count",   entries.size(),
            "entries", entries
        ));
    }

    // ── GET /robotpress/health ────────────────────────────────────────────────
    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> health() {
        RobotPressData latest = robotPressService.getLatest();
        return ResponseEntity.ok(Map.of(
            "status",          "ok",
            "service",         "robot-press-poller",
            "pendant_online",  latest.isPendantOnline(),
            "last_poll_ts",    latest.getLastPollTs() != null ? latest.getLastPollTs() : "never"
        ));
    }
}
