-- MES Line Side Board — Fake seed data
-- Resource: WM15 | Part: BMW1000D-360 | Shift 2 | Date: run-date (uses NOW())
--
-- Usage (from psql or DBeaver against mesdb):
--   \i seed/seed.sql
-- Or:
--   psql -h 192.168.1.126 -U mesapp -d mesdb -f seed/seed.sql

-- ── Schema (idempotent) ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS production_log (
    id               BIGSERIAL PRIMARY KEY,
    event_ts         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resource_id      TEXT        NOT NULL,
    part_number      TEXT        NOT NULL,
    operator_name    TEXT,
    shift_number     INTEGER     NOT NULL,
    good_count       INTEGER     DEFAULT 0,
    scrap_count      INTEGER     DEFAULT 0,
    cycle_time_sec   NUMERIC,
    notes            TEXT,
    confirmed        BOOLEAN     DEFAULT FALSE,
    confirmed_by     TEXT,
    confirmed_at     TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS downtime_log (
    id            BIGSERIAL PRIMARY KEY,
    start_ts      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resource_id   TEXT        NOT NULL,
    reason_code   TEXT        NOT NULL,
    minutes_lost  INTEGER,
    comment       TEXT,
    logged_by     TEXT
);

CREATE TABLE IF NOT EXISTS open_issues (
    id              BIGSERIAL PRIMARY KEY,
    raised_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resource_id     TEXT        NOT NULL,
    issue_type      TEXT        NOT NULL,
    severity        TEXT        NOT NULL DEFAULT 'minor',
    description     TEXT        NOT NULL,
    status          TEXT        NOT NULL DEFAULT 'open',
    raised_by       TEXT,
    acknowledged_by TEXT
);

-- ── Clear today's existing fake/test data for WM15 ───────────────────────────

DELETE FROM production_log
WHERE resource_id = 'WM15' AND DATE(event_ts) = CURRENT_DATE AND shift_number = 2;

DELETE FROM downtime_log
WHERE resource_id = 'WM15' AND DATE(start_ts) = CURRENT_DATE;

DELETE FROM open_issues
WHERE resource_id = 'WM15' AND status <> 'closed';

-- ── Production log — 8 hours of shift 2 ──────────────────────────────────────
-- One row per part cycle per hour (simplified to one aggregate row per hour)

INSERT INTO production_log
    (event_ts, resource_id, part_number, operator_name, shift_number,
     good_count, scrap_count, cycle_time_sec, notes, confirmed, confirmed_by, confirmed_at)
VALUES
-- Hour 14: on target
(CURRENT_DATE + INTERVAL '14 hours 30 minutes', 'WM15', 'BMW1000D-360', 'Yashwanta Thakur', 2,
 23, 1, 154.2, '', TRUE, 'Yashwanta Thakur', CURRENT_DATE + INTERVAL '14 hours 58 minutes'),

-- Hour 15: slightly under; tool wear starting
(CURRENT_DATE + INTERVAL '15 hours 30 minutes', 'WM15', 'BMW1000D-360', 'Yashwanta Thakur', 2,
 22, 0, 157.8, '', TRUE, 'Yashwanta Thakur', CURRENT_DATE + INTERVAL '15 hours 59 minutes'),

-- Hour 16: elevated scrap — bore OOT
(CURRENT_DATE + INTERVAL '16 hours 30 minutes', 'WM15', 'BMW1000D-360', 'Yashwanta Thakur', 2,
 21, 2, 159.1, 'Tooling adjustment — insert wear on station 3', FALSE, NULL, NULL),

-- Hour 17: equipment breakdown (zero output — press pendant fault F034)
(CURRENT_DATE + INTERVAL '17 hours 45 minutes', 'WM15', 'BMW1000D-360', 'Yashwanta Thakur', 2,
 0, 0, NULL, 'EQ breakdown — press pendant fault F034, 45 min lost', FALSE, NULL, NULL),

-- Hour 18: recovered — above target
(CURRENT_DATE + INTERVAL '18 hours 30 minutes', 'WM15', 'BMW1000D-360', 'Yashwanta Thakur', 2,
 24, 0, 148.5, 'Recovered — full hour running after reset', TRUE, 'Yashwanta Thakur', CURRENT_DATE + INTERVAL '18 hours 57 minutes'),

-- Hour 19: on target
(CURRENT_DATE + INTERVAL '19 hours 30 minutes', 'WM15', 'BMW1000D-360', 'Yashwanta Thakur', 2,
 23, 1, 152.3, '', TRUE, 'Yashwanta Thakur', CURRENT_DATE + INTERVAL '19 hours 58 minutes'),

-- Hour 20: slightly under
(CURRENT_DATE + INTERVAL '20 hours 30 minutes', 'WM15', 'BMW1000D-360', 'Yashwanta Thakur', 2,
 22, 0, 156.7, '', FALSE, NULL, NULL),

-- Hour 21: partial hour — shift winding down
(CURRENT_DATE + INTERVAL '21 hours 15 minutes', 'WM15', 'BMW1000D-360', 'Yashwanta Thakur', 2,
 15, 1, 155.0, 'Shift winding down', FALSE, NULL, NULL);

-- ── Downtime log ─────────────────────────────────────────────────────────────

INSERT INTO downtime_log
    (start_ts, resource_id, reason_code, minutes_lost, comment, logged_by)
VALUES
(CURRENT_DATE + INTERVAL '17 hours 12 minutes', 'WM15', 'EQ', 45,
 'Press pendant fault F034 — emergency stop triggered, reset + inspection performed',
 'Yashwanta Thakur'),

(CURRENT_DATE + INTERVAL '15 hours 45 minutes', 'WM15', 'PM', 12,
 'Tool change — insert replacement station 3 (scheduled)',
 'Yashwanta Thakur'),

(CURRENT_DATE + INTERVAL '14 hours 32 minutes', 'WM15', 'QA', 8,
 'First article inspection hold — new blank batch verification',
 'QA Lead');

-- ── Open issues ───────────────────────────────────────────────────────────────

INSERT INTO open_issues
    (raised_at, updated_at, resource_id, issue_type, severity, description, status, raised_by, acknowledged_by)
VALUES
(CURRENT_DATE + INTERVAL '17 hours 14 minutes',
 CURRENT_DATE + INTERVAL '17 hours 45 minutes',
 'WM15', 'Maintenance', 'critical',
 'Air press pendant showing intermittent fault F034 — requires immediate inspection',
 'in_progress', 'Yashwanta Thakur', 'Maintenance Team'),

(CURRENT_DATE + INTERVAL '16 hours 5 minutes',
 CURRENT_DATE + INTERVAL '16 hours 5 minutes',
 'WM15', 'Quality', 'major',
 'Elevated scrap on BMW1000D-360 — bore diameter OOT (+0.03mm), batch QC hold raised',
 'open', 'QA Lead', NULL),

(CURRENT_DATE + INTERVAL '19 hours 30 minutes',
 CURRENT_DATE + INTERVAL '19 hours 35 minutes',
 'WM15', 'Production', 'major',
 'BMW1000D-360 raw stock critically low — approx. 2hr supply remaining, material request sent',
 'open', 'Supervisor', 'Store'),

(CURRENT_DATE + INTERVAL '20 hours 15 minutes',
 CURRENT_DATE + INTERVAL '20 hours 15 minutes',
 'WM15', 'Safety', 'minor',
 'Oil residue near robot arm base — housekeeping required before next shift',
 'open', 'Yashwanta Thakur', NULL);

-- ── Verify ────────────────────────────────────────────────────────────────────

SELECT 'production_log rows' AS table_name, COUNT(*) AS rows FROM production_log WHERE DATE(event_ts) = CURRENT_DATE AND resource_id = 'WM15'
UNION ALL
SELECT 'downtime_log rows',                 COUNT(*) FROM downtime_log  WHERE DATE(start_ts)  = CURRENT_DATE AND resource_id = 'WM15'
UNION ALL
SELECT 'open_issues rows',                  COUNT(*) FROM open_issues   WHERE resource_id = 'WM15' AND status <> 'closed';
