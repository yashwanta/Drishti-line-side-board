package com.mes.mars.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mes.mars.model.RobotPressData;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Polls the robot air press pendant REST endpoint on a configurable interval
 * and maintains an in-memory cache of the latest reading + today's aggregates.
 *
 * The pendant is expected to return JSON with at least:
 *   { "peak_force": <float kN>, "program": "<string>",
 *     "alarm_code": "<string>", "alarm_desc": "<string>" }
 *
 * All field names are configurable in application.properties and can be adapted
 * to match the actual pendant's response schema.
 */
@Service
public class RobotPressService {

    private static final Logger log = LoggerFactory.getLogger(RobotPressService.class);

    @Value("${robotpress.pendant.url}")
    private String pendantUrl;

    @Value("${robotpress.force.min}")
    private double forceMin;

    @Value("${robotpress.force.max}")
    private double forceMax;

    private final AtomicReference<RobotPressData> latest = new AtomicReference<>(new RobotPressData());
    private final List<Double> todayForces = Collections.synchronizedList(new ArrayList<>());
    private final List<String> history     = Collections.synchronizedList(new ArrayList<>());

    private LocalDate lastResetDate = LocalDate.now();

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(4))
            .build();

    private final ObjectMapper mapper = new ObjectMapper();

    // ── Scheduled poller ──────────────────────────────────────────────────────

    /**
     * Poll the pendant every ROBOT_PRESS_POLL_MS milliseconds.
     * fixedDelayString reads from application.properties.
     */
    @Scheduled(fixedDelayString = "${robotpress.poll.interval.ms:10000}")
    public void pollPendant() {
        // Reset daily aggregates at midnight
        LocalDate today = LocalDate.now();
        if (!today.equals(lastResetDate)) {
            log.info("[robotpress] New day — resetting daily aggregates");
            todayForces.clear();
            lastResetDate = today;
        }

        try {
            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(pendantUrl))
                    .timeout(Duration.ofSeconds(4))
                    .GET()
                    .build();

            HttpResponse<String> resp = httpClient.send(req, HttpResponse.BodyHandlers.ofString());

            if (resp.statusCode() == 200) {
                parseAndUpdate(resp.body());
            } else {
                log.warn("[robotpress] Pendant returned HTTP {}", resp.statusCode());
                markOffline();
            }

        } catch (Exception ex) {
            log.warn("[robotpress] Poll failed — pendant may be offline: {}", ex.getMessage());
            markOffline();
        }
    }

    // ── Parsing ───────────────────────────────────────────────────────────────

    private void parseAndUpdate(String body) throws Exception {
        JsonNode root = mapper.readTree(body);

        double peakForce = jsonDouble(root, "peak_force", "peakForce", "force", "peak_force_kn");
        String program   = jsonString(root, "program", "recipe", "program_name");
        String alarmCode = jsonString(root, "alarm_code", "alarmCode", "fault_code");
        String alarmDesc = jsonString(root, "alarm_desc", "alarmDesc", "fault_desc", "fault_description");

        // Determine pass/fail
        boolean pass = peakForce >= forceMin && peakForce <= forceMax;
        String passFail = (peakForce == 0.0) ? "UNKNOWN" : (pass ? "PASS" : "FAIL");

        // Accumulate daily data
        if (peakForce > 0) {
            todayForces.add(peakForce);
            // Keep last 500 history entries
            String entry = Instant.now() + " | " + peakForce + " kN | " + passFail;
            if (history.size() >= 500) history.remove(0);
            history.add(entry);
        }

        // Build aggregates
        int passes = (int) todayForces.stream().filter(f -> f >= forceMin && f <= forceMax).count();
        int fails  = todayForces.size() - passes;
        double minF = todayForces.stream().mapToDouble(Double::doubleValue).min().orElse(0);
        double maxF = todayForces.stream().mapToDouble(Double::doubleValue).max().orElse(0);
        double avgF = todayForces.stream().mapToDouble(Double::doubleValue).average().orElse(0);
        double passRate = todayForces.isEmpty() ? 0 :
                Math.round((double) passes / todayForces.size() * 1000d) / 10d;

        RobotPressData data = new RobotPressData();
        data.setPeakForceKn(Math.round(peakForce * 100d) / 100d);
        data.setPassFail(passFail);
        data.setForceMinKn(forceMin);
        data.setForceMaxKn(forceMax);
        data.setProgram(program);
        data.setAlarmCode(alarmCode);
        data.setAlarmDesc(alarmDesc);
        data.setCyclesToday(todayForces.size());
        data.setPassesToday(passes);
        data.setFailsToday(fails);
        data.setPassRatePct(passRate);
        data.setMinForceTodayKn(Math.round(minF * 100d) / 100d);
        data.setMaxForceTodayKn(Math.round(maxF * 100d) / 100d);
        data.setAvgForceTodayKn(Math.round(avgF * 100d) / 100d);
        data.setLastPollTs(Instant.now().toString());
        data.setPendantOnline(true);

        latest.set(data);
        log.debug("[robotpress] Force={} kN | {} | Cycles today={}", peakForce, passFail, todayForces.size());
    }

    private void markOffline() {
        RobotPressData d = latest.get();
        d.setPendantOnline(false);
        d.setLastPollTs(Instant.now().toString());
        latest.set(d);
    }

    // ── Accessors ─────────────────────────────────────────────────────────────

    /** Returns the latest cached robot press snapshot. */
    public RobotPressData getLatest() {
        return latest.get();
    }

    /** Returns the last N history entries as a list of strings. */
    public List<String> getHistory(int limit) {
        int size = history.size();
        int from = Math.max(0, size - limit);
        return new ArrayList<>(history.subList(from, size));
    }

    // ── JSON helpers (handles multiple possible field names) ──────────────────

    private double jsonDouble(JsonNode root, String... keys) {
        for (String k : keys) {
            if (root.has(k)) {
                try { return root.get(k).asDouble(); } catch (Exception ignored) {}
            }
        }
        return 0.0;
    }

    private String jsonString(JsonNode root, String... keys) {
        for (String k : keys) {
            if (root.has(k)) {
                String v = root.get(k).asText("").trim();
                if (!v.isEmpty() && !v.equals("null")) return v;
            }
        }
        return "";
    }
}
