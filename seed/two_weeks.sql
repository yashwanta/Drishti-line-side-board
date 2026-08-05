-- Two weeks of deterministic fake Line Side Board data (today and prior 13 days).
-- Safe to rerun: only rows carrying the [FAKE-2W] marker are replaced.

\set ON_ERROR_STOP on

BEGIN;

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

DELETE FROM production_log WHERE notes LIKE '[FAKE-2W]%';
DELETE FROM downtime_log   WHERE comment LIKE '[FAKE-2W]%';
DELETE FROM open_issues    WHERE description LIKE '[FAKE-2W]%';

-- Eight hourly shift aggregates per day: 14 days x 8 rows = 112 rows.
INSERT INTO production_log
    (event_ts, resource_id, part_number, operator_name, shift_number,
     good_count, scrap_count, cycle_time_sec, notes, confirmed,
     confirmed_by, confirmed_at)
SELECT
    d.day + h.hour_no * INTERVAL '1 hour' + INTERVAL '30 minutes',
    'WM15',
    CASE WHEN d.day < CURRENT_DATE - 6 THEN 'BMW1000D-360' ELSE 'BMW2000E-180' END,
    CASE (EXTRACT(DAY FROM d.day)::int % 3)
        WHEN 0 THEN 'Yashwanta Thakur'
        WHEN 1 THEN 'Sarah Mbeki'
        ELSE 'Daniel Weber'
    END,
    2,
    GREATEST(0, 20 + ((EXTRACT(DAY FROM d.day)::int + h.hour_no) % 6)
        - CASE WHEN h.hour_no = 17 AND EXTRACT(DOW FROM d.day)::int IN (2, 5) THEN 12 ELSE 0 END),
    CASE WHEN (EXTRACT(DAY FROM d.day)::int + h.hour_no) % 7 = 0 THEN 2
         WHEN (EXTRACT(DAY FROM d.day)::int + h.hour_no) % 4 = 0 THEN 1 ELSE 0 END,
    ROUND((149 + ((EXTRACT(DAY FROM d.day)::int * 3 + h.hour_no) % 14))::numeric, 1),
    '[FAKE-2W] generated two-week history',
    h.hour_no < 20,
    CASE WHEN h.hour_no < 20 THEN 'Shift Supervisor' END,
    CASE WHEN h.hour_no < 20 THEN d.day + h.hour_no * INTERVAL '1 hour' + INTERVAL '58 minutes' END
FROM generate_series(CURRENT_DATE - 13, CURRENT_DATE, INTERVAL '1 day') AS d(day)
CROSS JOIN generate_series(14, 21) AS h(hour_no);

-- One representative downtime event per day.
INSERT INTO downtime_log
    (start_ts, resource_id, reason_code, minutes_lost, comment, logged_by)
SELECT
    d.day + INTERVAL '17 hours 12 minutes',
    'WM15',
    (ARRAY['PM','EQ','MT','QA','CL'])[1 + (EXTRACT(DAY FROM d.day)::int % 5)],
    8 + (EXTRACT(DAY FROM d.day)::int % 5) * 7,
    '[FAKE-2W] generated historical downtime',
    'Shift Supervisor'
FROM generate_series(CURRENT_DATE - 13, CURRENT_DATE, INTERVAL '1 day') AS d(day);

-- Six historical issues spread across the period; recent two remain active.
INSERT INTO open_issues
    (raised_at, updated_at, resource_id, issue_type, severity, description,
     status, raised_by, acknowledged_by)
SELECT
    d.day + INTERVAL '16 hours 5 minutes',
    d.day + INTERVAL '18 hours',
    'WM15',
    (ARRAY['Quality','Maintenance','Production','Safety'])[1 + (n % 4)],
    (ARRAY['minor','major','critical'])[1 + (n % 3)],
    '[FAKE-2W] generated historical issue ' || (n + 1),
    CASE WHEN n >= 4 THEN 'open' ELSE 'closed' END,
    'Shift Supervisor',
    CASE WHEN n % 2 = 0 THEN 'Area Lead' END
FROM generate_series(0, 5) AS s(n)
CROSS JOIN LATERAL (
    SELECT (CURRENT_DATE - 13 + n * 2)::timestamp AS day
) AS d;

COMMIT;

SELECT 'production_log' AS table_name, COUNT(*) AS fake_rows,
       MIN(event_ts)::date AS first_date, MAX(event_ts)::date AS last_date
FROM production_log WHERE notes LIKE '[FAKE-2W]%'
UNION ALL
SELECT 'downtime_log', COUNT(*), MIN(start_ts)::date, MAX(start_ts)::date
FROM downtime_log WHERE comment LIKE '[FAKE-2W]%'
UNION ALL
SELECT 'open_issues', COUNT(*), MIN(raised_at)::date, MAX(raised_at)::date
FROM open_issues WHERE description LIKE '[FAKE-2W]%';
