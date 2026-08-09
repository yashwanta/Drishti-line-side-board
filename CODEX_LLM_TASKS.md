# LSB — LLM Self-Healing Tasks for Codex
# Read one task at a time. Complete and confirm before moving to the next.
#
# LLM Server credentials are in API.txt at the project root:
#   Line 1 — Base URL:  https://llm.eidonix.com/
#   Line 2 — Model:     qwen3.6-35b
#   Line 3 — API Key:   (read from file, never hardcode in source)
#
# IMPORTANT: Always read API.txt at runtime, not at compile time.
# Store the key in config/.env under the variable LLM_API_KEY.
# The llm-config.json file must NOT contain the raw key — it must
# reference the env var instead.

---

## TASK 11 — LLM Client Package (do this FIRST — all other tasks depend on it)

Read CODEX_TASKS.md for overall project context.
Read API.txt in the project root. It contains three lines:
  Line 1 = base URL, Line 2 = model name, Line 3 = API key.

Create a reusable LLM client package at backend-go/llm/client.go

### What to build

1. On startup, load LLM configuration from TWO sources merged together:
   a) api/llm-config.json — non-secret settings:
      {
        "base_url": "https://llm.eidonix.com",
        "model": "qwen3.6-35b",
        "timeout_seconds": 120,
        "max_tokens": 2048
      }
   b) Environment variable LLM_API_KEY — the secret API key.
      Add LLM_API_KEY to config/.env (value copied from API.txt line 3).
      Never write the key into api/llm-config.json or any source file.

2. Export one function:
   func Ask(ctx context.Context, systemPrompt, userPrompt string) (string, error)

   HTTP call details:
   - Method: POST
   - URL: base_url + "/v1/chat/completions"
   - Headers:
       Content-Type: application/json
       Authorization: Bearer <LLM_API_KEY>
   - Request body (JSON):
       {
         "model": "<model>",
         "messages": [
           {"role": "system", "content": "<systemPrompt>"},
           {"role": "user",   "content": "<userPrompt>"}
         ],
         "max_tokens": <max_tokens>,
         "stream": false
       }
   - Parse response: try choices[0].message.content (OpenAI format) first.
     If that path is missing, try message.content (Ollama format).
     If that is also missing, try response.response (Ollama generate).
     Return the trimmed string, or a wrapped error with the raw body.

3. Export a health-check function:
   func Ping(ctx context.Context) error
   Send a minimal one-word prompt and verify a non-error HTTP response.

4. Logging rules (use slog):
   - Log at Debug level: model name, prompt byte length, response byte length, latency ms.
   - NEVER log prompt content or response content — they may contain production data.

5. Wire into the existing /health endpoint:
   Add "llm": "ok" or "llm": "unreachable" to the JSON response.
   Call llm.Ping() with a 5-second timeout inside the health handler.

6. Call llm.LoadConfig() once in main.go at startup, after the
   existing db.Connect() block. Log a warning (not a fatal) if the
   LLM server is unreachable at startup — the app must still start.

### Files to create/modify
- backend-go/llm/client.go          (new)
- api/llm-config.json               (new — no secret key)
- api/README.md                     (new — explains each field)
- config/.env                       (add LLM_API_KEY=... line)
- backend-go/main.go                (add LoadConfig call)
- backend-go/handlers/health.go     (add llm status field)

Do not modify any other existing files.

---

## TASK 12 — Log Analysis & Diagnosis

PREREQUISITE: Task 11 must be complete and go build ./... must pass.

Read CODEX_TASKS.md and backend-go/llm/client.go.

Add automated log analysis powered by the LLM.

### FILE: backend-go/handlers/loganalyze.go

#### A — HTTP endpoint: GET /api/llm/log-analysis

1. Read the last 200 lines from each of these files (skip silently if missing):
   - logs/lsb-go-error.log
   - logs/lsb-java-error.log

2. Call llm.Ask() with:

   System prompt:
   "You are an expert in Go microservices and Spring Boot Java.
    You are diagnosing a production manufacturing dashboard called
    Line Side Board (LSB). It has two Windows services:
    - LSB-Go: API gateway, serves the React frontend on port 3001,
      connects to PostgreSQL for OEE data.
    - LSB-Java: Spring Boot microservice on port 8080, connects to
      MARS SQL Server (read-only) for production KPIs.
    Analyse the error logs below and return ONLY a valid JSON object
    with this exact structure — no markdown, no explanation outside JSON:
    {
      \"issues\": [
        {
          \"service\": \"LSB-Go or LSB-Java\",
          \"severity\": \"info|warning|critical\",
          \"summary\": \"one sentence\",
          \"likely_cause\": \"one sentence\",
          \"recommended_fix\": \"one sentence\"
        }
      ],
      \"overall_health\": \"ok|degraded|critical\",
      \"one_liner\": \"one sentence summary for the IT manager\"
    }"

   User prompt: concatenated log lines with a header per file.

3. Parse the JSON from the LLM response. Return it as the API response
   with Content-Type: application/json.

4. Cache the result in memory for 5 minutes. Return the cached result
   on repeat calls within that window without calling the LLM again.

#### B — Background analyzer goroutine

5. Start a goroutine in main.go that runs every 60 minutes:
   - Runs the same logic as the HTTP handler above.
   - If overall_health is "critical", write a file:
     logs/llm-alert-<RFC3339-timestamp>.txt
     containing the full JSON diagnosis as pretty-printed text.
   - Log the one_liner field to slog at Warn level on every run.

### Wiring
- Add route GET /api/llm/log-analysis to main.go
  under the existing rate limiter middleware.
- Start the background goroutine in main.go after service startup.

---

## TASK 13 — OEE Anomaly Explanation + Auto-Remediation Suggestions

PREREQUISITE: Task 11 must be complete.

Read CODEX_TASKS.md and backend-go/llm/client.go.

### PART A — OEE Anomaly Detection with LLM Explanation

#### FILE: backend-go/handlers/oee_anomaly.go

1. Add this table to backend-go/db/schema.sql and create it in
   PostgreSQL at startup if it does not exist:

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

2. Background goroutine (start in main.go) that runs every 15 minutes:
   a) Query PostgreSQL:
      SELECT station, oee_value, recorded_at
      FROM oee_entries
      WHERE recorded_at > NOW() - INTERVAL '48 hours'
      ORDER BY station, recorded_at DESC
   b) Group results by station. For each station compute:
      - 24-hour rolling mean and standard deviation of oee_value
   c) Flag any entry where oee_value deviates more than 2 standard
      deviations from the mean as an anomaly.
   d) For each anomaly, call llm.Ask() with:

      System prompt:
      "You are an OEE (Overall Equipment Effectiveness) analyst for a
       manufacturing plant. When given an anomalous OEE reading, write
       2-3 sentences explaining the most likely operational cause and
       what the shift supervisor should physically check on the line.
       Be concise and practical. Use plain text only, no formatting."

      User prompt:
      "Station: {station}.
       Current OEE reading: {oee_value}%.
       24-hour average for this station: {mean}%.
       Standard deviation: {stddev}%.
       Deviation from mean: {deviation} standard deviations.
       Time of reading: {recorded_at}."

   e) Insert a row into oee_anomalies with the LLM explanation.
   f) Do not insert duplicate anomalies for the same station within
      30 minutes (check detected_at before inserting).

3. HTTP endpoint: GET /api/llm/anomalies?hours=24
   - hours param defaults to 24, max 168 (7 days)
   - Returns JSON array of oee_anomalies rows within the time window
   - Ordered by detected_at DESC

### PART B — Auto-Remediation Suggestions

#### FILE: backend-go/handlers/remediate.go

4. HTTP endpoint: POST /api/llm/remediate
   Request body: {"issue": "free text description of the problem"}

   Call llm.Ask() with:

   System prompt:
   "You are an IT remediation assistant for a manufacturing plant server.
    The server runs two Windows services managed by NSSM:
    - LSB-Java (Spring Boot, port 8080, connects to MARS SQL Server)
    - LSB-Go (Go API, port 3001, connects to PostgreSQL 15)
    On Linux the same services run as systemd units.
    Given an issue description, return ONLY a valid JSON object — no
    markdown, no text outside the JSON:
    {
      \"summary\": \"one sentence describing the problem\",
      \"safe_actions\": [
        {
          \"action\": \"what to do\",
          \"windows_command\": \"exact command for Windows\",
          \"linux_command\": \"exact command for Linux\",
          \"risk_level\": \"low|medium|high\"
        }
      ],
      \"do_not_do\": [\"list of actions to avoid\"],
      \"escalate_if\": \"condition that means this needs senior IT\"
    }"

   User prompt: the issue field from the request body.

5. Log every remediation request at Info level:
   timestamp, issue text length, response safe_actions count.
   Do not log the full issue text or response.

6. IMPORTANT SAFETY RULE — add this comment in the source code:
   // Auto-execution is intentionally disabled for safety.
   // This endpoint returns suggestions only. No system commands
   // are ever executed by this handler.
   The handler must NEVER call exec.Command or os/exec in any form.

### Wiring
- Add GET /api/llm/anomalies and POST /api/llm/remediate to main.go
  under the rate limiter middleware.
- Start the anomaly detection goroutine in main.go.
- Update backend-go/db/schema.sql with the oee_anomalies table DDL.

---

## TASK 14 — Daily Health Digest

PREREQUISITE: Tasks 11, 12, and 13 must be complete.

Read CODEX_TASKS.md and backend-go/llm/client.go.

Add a scheduled daily health digest that the LLM writes in plain English.

### FILE: backend-go/handlers/digest.go

1. Read the digest fire time from env var DIGEST_TIME (format "HH:MM",
   default "06:00", local server time). Add DIGEST_TIME=06:00 to
   config/.env template.

2. Background goroutine (start in main.go) using a 1-minute ticker:
   On each tick, check if current local time matches DIGEST_TIME (HH:MM).
   If it matches AND today's digest has not been generated yet, generate it.
   Track "already generated today" with an in-memory date variable.

3. When the digest fires, gather this data in parallel (use goroutines
   with a WaitGroup or errgroup):
   a) PostgreSQL — last 24h of oee_entries:
      SELECT station,
             ROUND(AVG(oee_value),1) as avg_oee,
             ROUND(MIN(oee_value),1) as min_oee,
             ROUND(MAX(oee_value),1) as max_oee,
             COUNT(*) as entry_count
      FROM oee_entries
      WHERE recorded_at > NOW() - INTERVAL '24 hours'
      GROUP BY station ORDER BY station
   b) PostgreSQL — last 24h of oee_anomalies:
      COUNT(*) total anomalies, MAX(ABS(deviation)) worst deviation,
      array of affected stations
   c) Filesystem — last 100 lines of logs/lsb-go-error.log and
      logs/lsb-java-error.log (skip if missing)
   d) In-memory — current health status (mode, llm status from last ping)

4. Build a plain-text summary of the gathered data (station table,
   anomaly count, error line count) and call llm.Ask() with:

   System prompt:
   "You are writing a daily operational health report for a plant IT
    manager and shift supervisor. Write in clear plain English using
    short paragraphs. Do not use bullet points or markdown formatting.
    Structure your report with these sections, each starting on a new
    line with the section name followed by a colon:
    System Health, OEE Summary, Anomalies Detected, Top Errors,
    Recommended Actions for Today.
    Keep the entire report under 400 words. Be direct and practical."

   User prompt: the plain-text data summary built in step 3.

5. Save the digest to: logs/digest-YYYY-MM-DD.txt
   (date = server local date when digest was generated)

6. HTTP endpoints:
   a) GET /api/llm/digest?date=YYYY-MM-DD
      Returns the digest file for the requested date as plain text
      (Content-Type: text/plain).
      If date param is omitted, return today's digest.
      If not yet generated, return HTTP 202 with body:
      {"status":"pending","scheduled_at":"HH:MM"}
   b) GET /api/llm/digest/list
      Returns JSON array of available digest dates in descending order:
      ["2026-08-08", "2026-08-07", ...]
      Reads the logs/ directory for files matching digest-*.txt

### Wiring
- Add both routes to main.go under the rate limiter middleware.
- Start the digest goroutine in main.go.
- Add DIGEST_TIME=06:00 to config/.env template.

---

## HOW TO USE THIS FILE

Give Codex ONE task at a time in order: 11 → 12 → 13 → 14.

After each task:
  1. Run: go build ./...
     Fix any compile errors before proceeding.
  2. Run: go test ./...
     Confirm existing tests still pass.
  3. Start the service and hit the new endpoint manually to confirm it works.
  4. Tell Codex "Task 1X is complete" and paste the next task.

The LLM API key must NEVER be committed to git.
Confirm .gitignore includes: config/.env and API.txt
