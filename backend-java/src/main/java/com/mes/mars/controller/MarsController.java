package com.mes.mars.controller;

import com.mes.mars.model.MarsKpi;
import com.mes.mars.model.MarsProductionRecord;
import com.mes.mars.service.MarsService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

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

    @Autowired
    private MarsService marsService;

    @Value("${plant.resource.id:WM15}")
    private String defaultResource;

    @Value("${plant.shift.num:2}")
    private int defaultShift;

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
    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok(Map.of(
            "status", "ok",
            "service", "mars-service",
            "database", "MARS SQL Server"
        ));
    }
}
