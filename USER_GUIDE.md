# Drishti Line Side Board — Complete User Guide

---

## What Is This Application?

**Drishti Line Side Board (LSB)** is a real-time manufacturing execution dashboard designed to be displayed on TVs and monitors mounted beside assembly lines on the factory floor. It gives workers, supervisors, and business leaders instant visibility into everything happening in the plant — production output, machine status, quality, downtime, shipping, and OEE — without needing to log into any ERP system or pull a report.

The name "Line Side Board" comes from the physical whiteboards traditionally hung beside production lines. This app replaces that whiteboard with a live, data-driven digital display.

---

## What Businesses Can Use It For

This application is purpose-built for **discrete manufacturing** environments — any plant that assembles, machines, stamps, or welds parts in defined workstations with measurable cycle times. Examples:

- **Automotive suppliers** (Tier 1 & Tier 2) — track output by station, OEE per cell, shipping to OEM customers
- **Metal fabrication shops** — monitor press, weld, and assembly cell efficiency
- **Plastics / injection molding** — cycle time tracking, scrap and rework rates
- **Electronics assembly** — first pass yield, operator performance, program changeovers
- **Any ISO/IATF 16949 certified facility** — the dashboard surfaces OEE, FPY, and downtime data required for quality audits

### Who uses it day-to-day

| Role | How They Use It |
|------|----------------|
| **Line Operator** | Sees their station's actual vs. plan, current cycle time, open issues |
| **Shift Supervisor** | Monitors all stations from one screen, responds to downtime alerts |
| **Quality Engineer** | Tracks first-pass yield, scrap/rework trends, 1×1 problem-solving sheets |
| **Maintenance Tech** | Sees which stations are in DOWNTIME and maintenance downtime minutes |
| **Plant Manager** | Executive Summary tab — plant health score, shift comparison, on-time delivery |
| **Logistics / Shipping** | Shipping tab — truck status, customer deliveries, on-time rate |
| **IE / Continuous Improvement** | OEE Analytics tab — 47-station breakdown, downtime split, operator performance |

### Business value delivered

- Eliminates the 10–15 minute delay between a production problem occurring and a supervisor knowing about it
- Replaces manual whiteboard updates (error-prone, time-consuming)
- Surfaces OEE and downtime data that previously required pulling an ERP report
- Gives business leaders a single plant health score instead of digging through spreadsheets
- Automatically alerts when efficiency drops below 75%, deliveries go late, or issues pile up
- Provides a digital 1×1 problem-solving record instead of paper forms that get lost

---

## How to Run the Application

### Option A — Standalone EXE (Recommended, no setup)

1. Copy `lsb-dashboard.exe` to any Windows PC on the plant network
2. Double-click `lsb-dashboard.exe`
3. Open a browser and go to `http://localhost:3001`
4. The dashboard loads immediately with live data (or mock data if no database is connected)

To display on a TV: open Chrome in kiosk mode:
```
chrome.exe --kiosk http://localhost:3001
```

To run at Windows startup, create a Shortcut to `lsb-dashboard.exe` and place it in:
```
C:\Users\<YourUser>\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup
```

### Option B — Development Mode (for IT / developers)

**Prerequisites:** Node.js 18+, Go 1.21+

```bash
# Terminal 1 — start the mock API server
go run seed/mock_server.go
# API available at http://localhost:3001

# Terminal 2 — start the frontend with hot reload
cd frontend
npm install
npm run dev
# Dashboard at http://localhost:5173
```

---

## Tab-by-Tab Guide

### 🎯 Executive Summary
The first tab. Designed for plant managers and business leaders.
- **Plant Health Score** — a 0–100 composite score calculated from efficiency, on-time delivery, OEE, and open issues. Green ≥85, Amber ≥70, Red below.
- **Top 3 KPIs** — Efficiency %, On-Time Delivery %, Open Issues — large tiles with one-click navigation
- **Shift Comparison** — current shift vs. previous shift with ▲▼ delta indicators
- **Bottom 5 Stations** — the 5 lowest-efficiency stations, colour-coded, with current part and status
- **Shipping Snapshot** — parts shipped, trucks, customer delivery status at a glance
- **Active Alerts** — any plant condition needing immediate attention, dismissible

### 🏭 Stations
Grid of all production stations. Click any station to switch the data view to that station and jump to the Production tab.

### ⚙ Production
Row-by-row production log for the selected station and shift — part number, quantities, cycle times, operator.

### 📊 Productivity
Hourly and shift productivity metrics — parts per hour, efficiency trend, JPH vs. target.

### ⚠ Issues
All open issues for the selected station. Each issue shows severity, description, raised time, and owner. Issue count badge appears on the tab when issues are open.

### ⏱ Downtime
Downtime breakdown for the selected station — categories, duration, frequency.

### 🤖 Robot Press
Live data from robot/press pendant controllers via the Java backend.

### 🗄 MARS Data
Raw data from the MARS ERP system — work orders, production schedule, quality records for the selected station.

### 🚛 Shipping
- Parts shipped today, shipment count, trucks loaded/pending
- Shipping dock status (ACTIVE / IDLE / MAINTENANCE)
- Next shipment ETA
- Customer delivery table with ONTIME / IN_TRANSIT / PENDING / LATE status badges
- 🖨 Print button — opens a clean white printable report

### 🔢 Floor Status
All stations in a grid showing real-time RUNNING / DOWNTIME / IDLE / SETUP status, actual vs. plan progress bar, efficiency %, current part, and cycle time. 🖨 Print button included.

### 📈 OEE Analytics
Deep OEE analysis sourced from your Assembly OEE Excel data:
- **Station OEE** — 47 stations sortable by OEE, JPH, or downtime. Filter by program or customer
- **Downtime Split** — stacked bar showing tooling / maintenance / production / material downtime per station
- **Top Issues** — ranked list of the 12 most costly downtime issues by total minutes
- **Program & Customer** — OEE by program (P33, P42, V363, VW416, WS), parts by customer with FG/WIP split
- **Operators** — 10-operator OEE grid and comparison bar chart
- **Month-over-Month** — production heatmap across 18 months with sparklines
- **➕ Log Entry** — manually log a shift's OEE data (date, shift, cell, downtime, output, quality). Auto-calculates Availability × Performance × Quality = OEE live as you type. Saves to local storage.
- **📋 Entries** — view and delete saved log entries

### 📋 1×1 Sheet
Digital 1×1 Problem Solving Sheets — create, fill out, and save structured problem-solving records. Upload scanned paper sheets (JPG, PNG, PDF up to 10 MB) as thumbnails, view full-size, or convert to a digital form.

### 🗺 Legend
Reference guide for all status colours, icons, and abbreviations used in the dashboard.

### 📅 Weekly
7-day OEE trend line chart with Best Day / Worst Day / Average cards and a day-by-day breakdown table.

---

## Alert System

The red banner between the KPI strip and the tab bar appears automatically when:
- Any **running station efficiency drops below 75%**
- Any customer delivery has status **LATE**
- **3 or more open issues** exist

When the alert fires:
- Red banner lists each alert condition
- Two-tone audio beep plays (880Hz then 660Hz) — requires browser audio permission
- Desktop notification sent if the browser tab is not in focus — requires notification permission

Click **✕ Dismiss** to hide the banner. It reappears automatically if a new alert condition arises on the next data refresh (every 15 seconds).

---

## Connecting to a SQL Server Database

### Architecture Overview

```
[Browser Dashboard]
        ↕ HTTP
[Go API Gateway — port 3001]
        ↕ HTTP proxy
[Java Microservice — port 8080]
        ↕ JDBC
[SQL Server / MARS ERP Database]
```

The dashboard never talks to the database directly. The Go gateway proxies requests to the Java service, which queries SQL Server.

### Step 1 — Install Java (if not already installed)

Download and install **Java 17 LTS** (OpenJDK or Oracle JDK):
- https://adoptium.net/temurin/releases/?version=17

Verify:
```cmd
java -version
```

### Step 2 — Configure the Java microservice

Open `backend-java/src/main/resources/application.properties`:

```properties
# SQL Server connection
spring.datasource.url=jdbc:sqlserver://YOUR_SERVER_NAME;databaseName=YOUR_DB_NAME;encrypt=true;trustServerCertificate=true
spring.datasource.username=YOUR_SQL_LOGIN
spring.datasource.password=YOUR_SQL_PASSWORD
spring.datasource.driver-class-name=com.microsoft.sqlserver.jdbc.SQLServerDriver

# Server port
server.port=8080
```

Replace:
- `YOUR_SERVER_NAME` — your SQL Server hostname or IP (e.g. `MARSDB01` or `192.168.1.50\SQLEXPRESS`)
- `YOUR_DB_NAME` — your MARS database name (e.g. `MARS_PROD`)
- `YOUR_SQL_LOGIN` / `YOUR_SQL_PASSWORD` — a read-only SQL login (see Step 4)

### Step 3 — Install Maven and build the Java service

Download Maven 3.9+: https://maven.apache.org/download.cgi

Add Maven `bin` folder to your Windows PATH, then:

```cmd
cd backend-java
mvn clean package -DskipTests
```

This produces `target/backend-java-0.0.1-SNAPSHOT.jar`.

### Step 4 — Create a read-only SQL Server login

Run in SQL Server Management Studio (SSMS) connected as `sa` or sysadmin:

```sql
-- Create login
CREATE LOGIN lsb_reader WITH PASSWORD = 'StrongPassword123!';

-- Create user in your database
USE YOUR_DB_NAME;
CREATE USER lsb_reader FOR LOGIN lsb_reader;

-- Grant read-only access
ALTER ROLE db_datareader ADD MEMBER lsb_reader;
```

This user can SELECT from all tables but cannot INSERT, UPDATE, or DELETE. The dashboard is read-only by design.

### Step 5 — Required SQL Server tables

The Java service expects these tables / views to exist in your database. If your MARS ERP already has them, map the column names in `backend-java/src/main/java/`. If not, create them:

```sql
-- Production KPIs per resource per shift
CREATE TABLE kpi_summary (
    resource_id     VARCHAR(20),
    shift           INT,
    actual          INT,
    plan            INT,
    efficiency_pct  DECIMAL(5,2),
    fpy_pct         DECIMAL(5,2),
    avg_cycle_sec   DECIMAL(6,2),
    hours_worked    DECIMAL(4,1),
    open_issues     INT,
    jph_target      INT,
    operator_name   VARCHAR(100),
    recorded_date   DATE,
    CONSTRAINT pk_kpi PRIMARY KEY (resource_id, shift, recorded_date)
);

-- Production rows (parts logged)
CREATE TABLE production_log (
    id              INT IDENTITY PRIMARY KEY,
    resource_id     VARCHAR(20),
    shift           INT,
    part_number     VARCHAR(50),
    work_order      VARCHAR(50),
    quantity_good   INT,
    quantity_scrap  INT,
    cycle_time_sec  DECIMAL(6,2),
    operator_name   VARCHAR(100),
    logged_at       DATETIME DEFAULT GETDATE()
);

-- Open issues
CREATE TABLE issues (
    id              INT IDENTITY PRIMARY KEY,
    resource_id     VARCHAR(20),
    description     VARCHAR(500),
    severity        VARCHAR(10),   -- LOW / MEDIUM / HIGH
    status          VARCHAR(20),   -- OPEN / IN_PROGRESS / CLOSED
    raised_by       VARCHAR(100),
    raised_at       DATETIME DEFAULT GETDATE(),
    closed_at       DATETIME
);

-- Downtime records
CREATE TABLE downtime_log (
    id              INT IDENTITY PRIMARY KEY,
    resource_id     VARCHAR(20),
    category        VARCHAR(50),   -- TOOLING / MAINTENANCE / PRODUCTION / MATERIAL / QUALITY
    reason          VARCHAR(200),
    duration_min    INT,
    started_at      DATETIME,
    ended_at        DATETIME
);

-- Shipping / customer deliveries
CREATE TABLE shipping_deliveries (
    work_order      VARCHAR(50) PRIMARY KEY,
    customer        VARCHAR(100),
    part_number     VARCHAR(50),
    qty             INT,
    ship_by         VARCHAR(10),
    status          VARCHAR(20),   -- SHIPPED / IN_TRANSIT / PENDING / ONTIME / LATE
    delivery_date   DATE,
    shipped_at      DATETIME
);

-- OEE shift entries (from Log Entry form)
CREATE TABLE oee_entries (
    id              INT IDENTITY PRIMARY KEY,
    entry_date      DATE,
    shift           INT,
    cell            VARCHAR(50),
    part_number     VARCHAR(50),
    tool_dt_min     INT DEFAULT 0,
    top_tool_issue  VARCHAR(200),
    maint_dt_min    INT DEFAULT 0,
    top_maint_issue VARCHAR(200),
    prod_dt_min     INT DEFAULT 0,
    top_prod_issue  VARCHAR(200),
    parts_reported  INT DEFAULT 0,
    target_cycle_sec DECIMAL(6,2),
    actual_cycle_sec DECIMAL(6,2),
    scrap           INT DEFAULT 0,
    rework          INT DEFAULT 0,
    availability_pct DECIMAL(5,2),
    performance_pct DECIMAL(5,2),
    quality_pct     DECIMAL(5,2),
    oee_pct         DECIMAL(5,2),
    created_at      DATETIME DEFAULT GETDATE()
);
```

### Step 6 — Start all services

Open three command prompt windows:

**Window 1 — Java microservice:**
```cmd
cd backend-java
java -jar target/backend-java-0.0.1-SNAPSHOT.jar
```
Wait for: `Started Application in X seconds`

**Window 2 — Go API gateway:**
```cmd
go run backend-go/main.go
```
Wait for: `Listening on :3001`

**Window 3 — Frontend (dev only, skip for EXE):**
```cmd
cd frontend
npm run dev
```

Open browser: `http://localhost:3001`

The MARS Data tab will now show live SQL Server data. The other tabs will show live data as the Java service populates them.

### Step 7 — Verify the connection

In a browser or Postman, test:
```
GET http://localhost:8080/api/kpis?resource=WM15&shift=2
```
Should return JSON. If you see `{"error":"..."}`, check your `application.properties` credentials and SQL Server firewall rules.

### Firewall / Network notes
- SQL Server default port: **1433** — must be open between the Go/Java server and the SQL Server host
- If SQL Server is on the same PC: use `localhost` or `127.0.0.1`
- If on a domain network: use the server's FQDN (e.g. `MARSDB01.plant.local`)
- Named instances: `SERVER\INSTANCENAME` (e.g. `MARSDB01\SQLEXPRESS`)

---

## Dependencies Summary

| Component | Technology | Version | Download |
|-----------|-----------|---------|----------|
| Frontend | React + Vite | React 18, Vite 5 | Bundled in EXE |
| API Gateway | Go | 1.21+ | https://go.dev/dl |
| ERP Connector | Java + Spring Boot | Java 17, Spring 3 | https://adoptium.net |
| Build tool | Maven | 3.9+ | https://maven.apache.org |
| Database | SQL Server | 2016+ | Existing MARS install |
| JDBC Driver | mssql-jdbc | 12.x | Auto-downloaded by Maven |
| Browser | Chrome / Edge | Any modern | Existing |

**For the EXE only (no database):** No dependencies at all. Just the `.exe` file.

---

## Frequently Asked Questions

**Q: Can multiple people use it at the same time?**
Yes. The Go server handles concurrent connections. Run the EXE on one PC, share the URL `http://YOUR_PC_IP:3001` with anyone on the same network.

**Q: Does it work without internet?**
Yes. Everything runs locally. No cloud services, no external APIs, no license calls.

**Q: What if the database is down?**
The dashboard continues to show the last data it received. The status pill in the header changes to `⚠ API ERROR`. When the database recovers, data resumes on the next 15-second refresh.

**Q: Can I change the refresh interval?**
Yes. In `frontend/src/App.jsx`, line: `const REFRESH_MS = 15_000`. Change `15_000` to any millisecond value and rebuild.

**Q: Can I add more stations?**
Yes. Add rows to the `kpi_summary` and `production_log` tables with the new `resource_id`. The Stations tab auto-populates from the database.

**Q: Is the data secure?**
The dashboard is read-only — it cannot write to your ERP database (except the OEE Log Entry form, which saves to the local SQL `oee_entries` table only). Run it on your internal plant network only; do not expose port 3001 to the internet.
