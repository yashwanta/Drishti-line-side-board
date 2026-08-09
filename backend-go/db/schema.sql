-- LSB Operational Database Schema
-- Applied automatically by the setup wizard at /api/setup/configure-postgres
-- Can also be run manually: psql -U lsb_admin -d lsb_oee -f schema.sql

CREATE TABLE IF NOT EXISTS production_log (
			id BIGSERIAL PRIMARY KEY,
			resource_id VARCHAR(50) NOT NULL,
			shift_num INT NOT NULL,
			event_ts TIMESTAMPTZ NOT NULL,
			part_number VARCHAR(100),
			operator_name VARCHAR(100),
			good_count INT NOT NULL DEFAULT 0,
			scrap_count INT NOT NULL DEFAULT 0,
			cycle_time_sec NUMERIC(10,2),
			notes TEXT,
			confirmed BOOLEAN NOT NULL DEFAULT FALSE,
			confirmed_by VARCHAR(100),
			confirmed_at TIMESTAMPTZ
		);

CREATE INDEX IF NOT EXISTS idx_production_log_resource_shift_event
			ON production_log (resource_id, shift_num, event_ts);

CREATE TABLE IF NOT EXISTS issues (
			id BIGSERIAL PRIMARY KEY,
			resource_id VARCHAR(50) NOT NULL,
			issue_type VARCHAR(100),
			severity VARCHAR(20) NOT NULL DEFAULT 'minor',
			description TEXT,
			status VARCHAR(30) NOT NULL DEFAULT 'open',
			raised_by VARCHAR(100),
			acknowledged_by VARCHAR(100),
			raised_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);

CREATE INDEX IF NOT EXISTS idx_issues_resource_status_raised
			ON issues (resource_id, status, raised_at);

CREATE TABLE IF NOT EXISTS oee_entries (
			id BIGSERIAL PRIMARY KEY,
			entry_date DATE NOT NULL,
			shift INT NOT NULL,
			cell VARCHAR(100) NOT NULL,
			part_number VARCHAR(100),
			tool_dt_min INT NOT NULL DEFAULT 0,
			top_tool_issue VARCHAR(500),
			maint_dt_min INT NOT NULL DEFAULT 0,
			top_maint_issue VARCHAR(500),
			prod_dt_min INT NOT NULL DEFAULT 0,
			top_prod_issue VARCHAR(500),
			parts_reported INT NOT NULL DEFAULT 0,
			target_cycle_sec NUMERIC(12,3) NOT NULL DEFAULT 0,
			actual_cycle_sec NUMERIC(12,3) NOT NULL DEFAULT 0,
			scrap INT NOT NULL DEFAULT 0,
			rework INT NOT NULL DEFAULT 0,
			availability_pct NUMERIC(8,3) NOT NULL DEFAULT 0,
			performance_pct NUMERIC(8,3) NOT NULL DEFAULT 0,
			quality_pct NUMERIC(8,3) NOT NULL DEFAULT 0,
			oee_pct NUMERIC(8,3) NOT NULL DEFAULT 0,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);

CREATE INDEX IF NOT EXISTS idx_oee_entries_date_shift_cell
			ON oee_entries (entry_date, shift, cell);

CREATE TABLE IF NOT EXISTS oee_anomalies (
  id           SERIAL PRIMARY KEY,
  station      TEXT NOT NULL,
  oee_value    NUMERIC(5,2),
  mean_value   NUMERIC(5,2),
  std_dev      NUMERIC(5,2),
  deviation    NUMERIC(5,2),
  detected_at  TIMESTAMPTZ DEFAULT NOW(),
  llm_explanation TEXT
);
