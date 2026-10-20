---
title: "Drishti Line Side Board Work Instruction"
source: "Drishti_Line_Side_Board_Work_Instruction.docx"
created: 2026-08-10
tags:
  - "docx"
  - "siteops"
  - "documentation"
---

![image](Drishti_Line_Side_Board_Work_Instruction-assets/image-1.png)

**WORK INSTRUCTION**

# **Drishti Line Side Board**

## Connection, Deployment, Operation, and Troubleshooting Guide

Document ID: LSB-WI-001  
Revision: 1.1  
Issued: 10 August 2026  
System version referenced: 2.0

_Audience: Plant IT, controls/automation, supervisors, operators, quality, maintenance, and logistics_

# 1. Document Control and Purpose

| **Field** | **Value** |
| --- | --- |
| Purpose | Explain how to start, connect, validate, and use the Drishti Line Side Board. |
| Primary owner | Plant IT / Cybersecurity |
| Operational owners | Production supervisor and designated line operators |
| Applies to | Repository and packaged artifacts present on 10 August 2026 |
| Change control | Retest connection, health endpoint, write actions, and dashboard refresh after every release. |

## 1.1 Scope

This work instruction covers the Windows standalone demonstration executable, the intended Windows live-production Go service, SQL Server and PostgreSQL connectivity, browser access, core dashboard workflows, service maintenance, security, and troubleshooting.

**RELEASE STATUS  **The demo/training path is the safest immediately usable path. The repository's live-production pieces are not fully aligned; Section 13 lists the exact gaps that must be closed before plant approval.

## 1.2 Roles and responsibilities

| **Role** | **Responsibility** |
| --- | --- |
| Plant IT | Install runtime, create service, manage firewall, credentials, logs, backups, and upgrades. |
| Database administrator | Provide least-privilege accounts, validate expected tables/views, and approve schema creation. |
| Supervisor | Select station/date, monitor alerts, validate entries, and escalate data discrepancies. |
| Operator | Confirm production hours, log downtime, and raise issues using accurate event details. |
| Quality / Maintenance | Review issue and downtime drill-downs; record containment or corrective-action notes. |

# 2. System Overview

The dashboard is a React user interface served through a Go HTTP server. Users connect with a browser. The browser calls only the Go API; it never connects directly to a database.

**Browser / TV  →  Go web server :3001  →  PostgreSQL operational data  
                                              ↘  SQL Server / MARS reporting data**

| **Component** | **Purpose** | **Default access** |
| --- | --- | --- |
| Dashboard | Operator and management user interface | http://SERVER:3001 |
| Go server | Serves the UI and /api endpoints | TCP 3001 |
| PostgreSQL | Production log, issues, downtime, OEE/anomaly data | TCP 5432 |
| SQL Server / MARS | Station, production status, shipping, weekly, and MARS views | TCP 1433 |
| pgAdmin (local only) | Development database administration | http://localhost:5050 |

**NETWORK RULE  **Expose port 3001 only to the approved plant LAN. Keep PostgreSQL and SQL Server ports restricted to the application host and authorized administration stations.

# 3. Choose the Correct Operating Mode

| **Need** | **Use** | **Result** |
| --- | --- | --- |
| Training, demonstration, UI evaluation | Standalone lsb-dashboard.exe in mock mode | No database dependency; simulated data. |
| Developer testing with local PostgreSQL | Podman compose with docker-compose.local-db.yml | Local database, pgAdmin, API, and frontend development ports. |
| Plant live data | backend-go live service after Section 13 readiness items are resolved | PostgreSQL operational data plus SQL Server/MARS queries. |

**DO NOT CONFUSE THE MODES  **A successful SQL connection test does not by itself prove that every dashboard endpoint, expected table, static asset, or Windows service behavior is ready.

# 4. Quick Start - Demo / Training Mode

**STEP 1  ****Copy the runtime**

Place lsb-dashboard.exe in a controlled folder such as C:\Drishti-LSB. Keep config\.env.example with the application if first-run configuration must be recreated.

**STEP 2  ****Start the application**

Double-click lsb-dashboard.exe. A console window reports the listening address and current mode. Leave it open while using the dashboard.

**STEP 3  ****Open the dashboard**

Open Chrome or Microsoft Edge and browse to http://localhost:3001. On another approved device, use http://<application-server-IP>:3001.

**STEP 4  ****Select demo data**

On the first-run screen, choose Run with Demo Data. The application writes LSB_MODE=mock into config\.env and reloads the dashboard.

**STEP 5  ****Verify**

Confirm that the Stations tab opens, the footer shows LIVE, and KPI tiles populate. Then open /health in a separate tab and confirm mode is mock.

```
http://localhost:3001/health
http://localhost:3001/api/health
```

## 4.1 Kiosk display

```
chrome.exe --kiosk http://localhost:3001
```

- Disable sleep and display timeout on the TV controller PC.

- Allow browser audio and notification permissions only if plant policy permits alert tones and desktop notifications.

- Use a dedicated, non-administrator Windows account for unattended displays.

## 4.2 Return to first-run setup

Stop the executable, edit config\.env, set LSB_MODE=unconfigured, save, and restart. Back up the file first; it may contain database credentials.

# 5. Live Connection Planning

## 5.1 Prerequisites

- **Windows host: **64-bit Windows, local administrator for installation, fixed IP or DNS name, correct time zone, and current patches.

- **Build workstation: **Go toolchain matching go.mod (currently Go 1.25.7), Node.js/npm, and network access to restore dependencies.

- **SQL Server: **Reachable server/database, TCP 1433 or approved custom port, SQL authentication supported, and Microsoft ODBC Driver 18 when Excel import is used.

- **PostgreSQL: **Reachable PostgreSQL 15+ database for operational tables; PostgreSQL 17 is used by the local container configuration.

- **Browser: **Current Chrome or Edge on the plant network.

## 5.2 Connection worksheet

| **Item** | **Value to record** | **Validation** |
| --- | --- | --- |
| Application server | ________________________ | Resolves and accepts TCP 3001 |
| Plant LAN/CIDR | ________________________ | Example: 192.168.10.0/24 |
| SQL Server / port | ________________________ | Test-NetConnection ... -Port 1433 |
| SQL database | ________________________ | Login can query required dbo objects |
| PostgreSQL / port | ________________________ | Test-NetConnection ... -Port 5432 |
| PostgreSQL database | ________________________ | Schema applied successfully |
| Default resource / shift | ________________________ | Matches production master data |
| JPH target | ________________________ | Approved by production/IE |

## 5.3 Connectivity tests

```
Test-NetConnection SQLSERVER01 -Port 1433
Test-NetConnection POSTGRES01 -Port 5432
Test-NetConnection LSB-SERVER -Port 3001
```

**CREDENTIAL HANDLING  **Never place real passwords in screenshots, tickets, email, source control, or this work instruction. Restrict config\.env to the service identity and designated administrators.

# 6. Prepare the Databases

## 6.1 PostgreSQL operational database

Create the database and a dedicated service account. Apply backend-go\db\schema.sql, then verify the required runtime tables. The current schema file creates production_log, issues, oee_entries, and oee_anomalies.

```
psql -U lsb_admin -d lsb_oee -f backend-go\db\schema.sql
```

**REQUIRED CORRECTION  **The runtime downtime handler expects the configured DT_TABLE (normally downtime_log) with id, resource_id, reason_code, minutes_lost, comment, start_ts, and logged_by. That table is not present in the current schema.sql and must be added and DBA-approved before downtime logging is enabled.

## 6.2 SQL Server / MARS data source

The current Go MARS handlers query dbo.ProductionLog, dbo.ShippingLog, and dbo.DowntimeLog. Confirm the real MARS object names and column mappings with the DBA before rollout.

| **Object** | **Columns referenced by current code** |
| --- | --- |
| dbo.ProductionLog | ResourceID, ShiftNum, EventTS, GoodQty |
| dbo.ShippingLog | PartQty, TruckStatus, ShipDate |
| dbo.DowntimeLog | ResourceID, ReasonCode, StartTS, EndTS |

- Use a read-only SQL Server account for reporting queries.

- If OEE entries or shift notes are stored in SQL Server, grant only the explicit INSERT/SELECT permissions needed for those tables.

- Do not grant sysadmin or db_owner to the runtime account.

- Keep TLS encryption enabled. Replace TrustServerCertificate=true with certificate validation when the plant PKI is ready.

# 7. Configure Live Mode

For the current backend-go service, configure config\.env manually. Do not rely on the frontend first-run wizard until the endpoint mismatch in Section 13 is corrected.

```
LSB_MODE=production

LSB_DB_SERVER=SQLSERVER01
LSB_DB_PORT=1433
LSB_DB_NAME=MARS_PROD
LSB_DB_USER=<service_account>
LSB_DB_PASSWORD=<secret>
LSB_DB_ENCRYPT=true
LSB_DB_TRUST_SERVER_CERTIFICATE=true

DB_HOST=POSTGRES01
DB_PORT=5432
DB_NAME=lsb_oee
DB_USER=<service_account>
DB_PASS=<secret>

PORT=3001
CORS_SUBNET=192.168.10.0/24
RESOURCE_ID=WM15
SHIFT_NUM=2
JPH_TARGET=23
OPERATOR_NAME=<default_operator>
PROD_TABLE=production_log
DT_TABLE=downtime_log
ISSUES_TABLE=issues
```

**IMPORTANT  **The application reads configuration at process start. Restart the process or service after any config\.env change.

# 8. Build and Run the Live Go Service

## 8.1 Pilot build in a console

The present frontend build writes to exe\build, while backend-go serves .\static. For a controlled pilot, copy the built assets into backend-go\static before starting the server from the backend-go directory.

```
cd frontend
npm ci
npm run build
cd ..
New-Item -ItemType Directory -Force backend-go\static
Copy-Item exe\build\* backend-go\static -Recurse -Force
cd backend-go
go build -o lsb-api.exe .
.\lsb-api.exe
```

- Keep the PowerShell window open during the pilot.

- Browse to http://localhost:3001 and run all checks in Section 9.

- If the process exits immediately, inspect the console output; PostgreSQL startup failure is fatal when DB_HOST is configured.

## 8.2 Windows service

install-service.bat creates the automatic Windows service LSB-Go and expects backend-go\lsb-api.exe. Run it only from an elevated Command Prompt after a successful console pilot.

```
install-service.bat
sc.exe query LSB-Go
net stop LSB-Go
net start LSB-Go
```

**SERVICE WORKING DIRECTORY  **The current sc.exe service definition does not set a working directory, while the Go server uses relative paths for config and static files. Prove config loading and dashboard delivery under the service account before approving unattended operation.

## 8.3 Firewall and client access

- Permit inbound TCP 3001 only from the approved plant subnet.

- Do not expose TCP 3001 directly to the internet.

- Clients use http://<server-name-or-IP>:3001. Use localhost only on the application host.

- For production confidentiality and integrity, place the service behind an approved HTTPS reverse proxy or internal load balancer.

# 9. Commissioning and Acceptance Tests

| **Test** | **Expected result** | **Pass** |
| --- | --- | --- |
| GET /health | status ok; mode production; mssql ok; expected database name | ☐ |
| Dashboard root | UI loads without 404/blank screen | ☐ |
| Stations | Station list matches MARS/ProductionLog | ☐ |
| Production | Selected station shows current-shift records | ☐ |
| Historical date | Older date loads and auto-refresh pauses | ☐ |
| Confirm hour | Confirmation persists in PostgreSQL | ☐ |
| Raise issue | New issue appears for selected station | ☐ |
| Log downtime | Event saves and totals update | ☐ |
| MARS data | Queries complete without placeholder-table errors | ☐ |
| Remote client | Approved client opens dashboard via server address | ☐ |
| Restart | Service restarts and retains production configuration | ☐ |

```
Invoke-RestMethod http://localhost:3001/health
Invoke-RestMethod http://localhost:3001/api/kpis?resource=WM15&shift=2
```

**ACCEPTANCE RULE  **Do not sign off live operation if any API returns 404/503, the footer shows API ERROR, a required write action does not persist, or the dashboard displays simulated data while labeled production.

# 10. Daily Operator Use

## 10.1 Start-of-shift check

Open the dashboard and confirm the footer status is LIVE, not CONNECTING or API ERROR.

Confirm the displayed resource, Shift 2 label, date, operator, and last-updated time are correct.

Open Stations and select the assigned station. Selection moves the view to Production.

Compare actual, plan, efficiency, FPY, cycle time, and open-issue count with the line condition.

Report a mismatch before entering confirmations or downtime events.

## 10.2 Date navigation

- Use the left arrow in the header to view the previous day.

- Historical mode shows an amber banner and pauses the 15-second auto-refresh.

- Use Return to Live to return to today and resume automatic refresh.

- The current UI uses a fixed Shift 2 value; shift selection is not exposed as a user control.

## 10.3 Alerts

The alert banner appears when a running station is below 75% efficiency, a customer delivery is late, or three or more issues are open. Dismiss hides the current set; a changed alert set can show it again on a later refresh.

# 11. Data-Entry Workflows

## 11.1 Confirm an hourly production row

Select the correct station and verify today's date.

Open Production and inspect the hour, part, operator, good/scrap quantity, gap, and cycle time.

Choose Confirm only after comparing the row with the approved source record.

Wait for the row to refresh and show confirmed status. If it does not persist, stop and notify IT.

**RECORD INTEGRITY  **The confirmation identity comes from OPERATOR_NAME in the server configuration, not an interactive login. Shared displays therefore require an approved accountability procedure.

## 11.2 Log downtime

Open Downtime for the selected station.

Choose the closest reason: Equipment Failure, Tooling Change, Material Shortage, Quality Hold, Scheduled Break, Shift Changeover, Robot / Press Fault, Network / IT, Safety Stop, or Other.

Enter duration from 1 to 480 minutes and a concise comment describing what happened.

Choose Log Downtime Event and verify the event appears in Today's Downtime Log.

Select a downtime category to review top reasons and record an action taken. Category action text is currently stored in browser local storage, not the server database.

## 11.3 Raise and review an issue

Open Issues and choose + Raise Issue.

Select issue type and severity; describe the observable condition, containment, and affected part/station.

Submit and verify the new issue card appears.

Open a card for details. Resolution notes and visual status progression are currently browser-local in parts of the UI; confirm the plant system of record separately.

## 11.4 OEE log entry

Open OEE Analytics and choose Log Entry.

Enter date, shift, cell, part, downtime minutes/reasons, output, target and actual cycle time, scrap, and rework.

Review the calculated Availability × Performance × Quality result before saving.

Open Entries and confirm the saved record is returned by the server in production mode.

# 12. Tab Reference

| **Tab** | **Primary use** | **Typical user** |
| --- | --- | --- |
| Executive Summary | Plant health, top KPIs, shift comparison, bottom stations, shipping and alerts | Plant manager |
| Stations | Select a station and view status/efficiency | Supervisor |
| Production | Hourly output, plan gap, scrap, cycle time, confirmation | Operator / supervisor |
| Productivity | Hourly and shift output trend against JPH | Supervisor / IE |
| Issues | Open issues, severity, ownership, detail | Quality / maintenance |
| Downtime | Log events, totals, categories, and actions | Operator / maintenance |
| Robot Press | Robot/press status and history | Maintenance |
| MARS Data | MARS KPI, production, quality, and schedule views | Production control |
| Shipping | Shipment and customer-delivery status; printable view | Logistics |
| Floor Status | All-station running/downtime/idle/setup view | Supervisor |
| OEE Analytics | OEE breakdown, issues, programs, operators, trends, manual entries | IE / CI |
| 1×1 Sheet | Structured problem-solving record and attachment handling | Quality / CI |
| Legend | Status colors, icons, and abbreviations | All users |
| Weekly | Seven-day production/OEE trend | Management |
| AI Health | Log health, anomalies, remediation guidance, daily digests | Plant IT |
| TV Mode | Large-format shop-floor view | All roles |

**PRINT OUTPUT  **Shipping and Floor Status include print actions. Preview before printing and verify the selected station/date because browser print output does not prove the underlying data is current.

# 13. Current Pre-Go-Live Gaps

These findings come from the repository state used to prepare this instruction. Resolve and retest them before treating the live-production procedure as released.

| **Gap** | **Operational impact** | **Required disposition** |
| --- | --- | --- |
| Standalone exe live routes | In production mode, the standalone exe returns service unavailable for direct production routes. | Use mock mode only or implement live handlers. |
| Service build target | DEPLOYMENT.md builds .\exe\ into backend-go\lsb-api.exe, although that executable is the standalone/mock server. | Build the intended server explicitly and align installer documentation. |
| Frontend output path | Vite writes exe\build; backend-go serves .\static. | Unify build output or add a verified copy/package step. |
| Setup API mismatch | Frontend calls /api/setup/test-connection; backend-go registers configure-mssql/configure-postgres. | Align UI and backend endpoints; add integration test. |
| PostgreSQL schema | downtime_log required by runtime is absent from schema.sql. | Add migration and validate read/write behavior. |
| Docker topology | docker-compose.yml references backend-java, but no backend-java directory is present in this repository. | Restore the service or remove/update the compose dependency. |
| MARS placeholders | ShippingLog and DowntimeLog are marked TODO pending DBA confirmation. | Map approved production views/columns. |
| Windows service paths | Relative config/static paths may resolve from an unexpected service working directory. | Use absolute paths or a wrapper/service host with explicit working directory. |
| Operator identity | Writes rely on configured OPERATOR_NAME rather than authenticated users. | Add authentication or an approved shared-terminal control. |

**RELEASE GATE  **A successful demo is not a live-production acceptance test. Close every applicable gap, rerun Section 9, and record approval from IT, DBA, production, and cybersecurity.

# 14. Service Maintenance

| **Task** | **Command / action** |
| --- | --- |
| Service status | sc.exe query LSB-Go |
| Start | net start LSB-Go |
| Stop | net stop LSB-Go |
| Remove | uninstall-service.bat (elevated prompt) |
| Health | Invoke-RestMethod http://localhost:3001/health |
| Foreground log | Run backend-go\lsb-api.exe from backend-go and observe console JSON logs |
| Configured log | Set LOG_FILE to an approved absolute path, restart, and monitor that file |

## 14.1 Update procedure

Record the current version and export/back up config\.env without placing it in source control.

Back up operational database data using the DBA-approved method.

Stop LSB-Go and replace only approved binaries/static assets; preserve runtime configuration.

Start the service and repeat health, browser, read, write, remote-client, and restart tests.

Retain a recoverable copy of the prior release until acceptance is complete.

# 15. Troubleshooting

| **Symptom** | **Likely cause** | **Action** |
| --- | --- | --- |
| Browser cannot connect | Process stopped, wrong address, firewall | Check service/process, /health locally, TCP 3001, then client DNS/routing. |
| First-run screen repeats | LSB_MODE unconfigured or config not writable/read | Stop app; verify config\.env path, permissions, and saved mode; restart. |
| API ERROR footer | One or more core API calls failed | Check /health, server logs, PostgreSQL reachability, table names, and credentials. |
| mssql unreachable | SQL network/login/TLS issue | Test TCP port; verify LSB_DB_*; check SQL logs and certificate settings. |
| Server exits on start | PostgreSQL connection failure | Validate DB_HOST/PORT/NAME/USER/PASS from the server and database permissions. |
| Blank page or static 404 | Frontend assets absent or wrong working directory | Verify backend-go\static and service working directory; test in foreground. |
| Downtime save fails | Missing downtime table or permissions | Apply approved migration; verify DT_TABLE and INSERT/SELECT rights. |
| MARS tab fails | Expected dbo object/column mismatch | Have DBA map ProductionLog, ShippingLog, DowntimeLog or approved views. |
| Historical date does not change | Some handlers use server 'today' | Treat as a defect; verify endpoint supports date before relying on history. |
| Excel import fails | ODBC Driver/Python/dependency/path issue | Verify ODBC Driver 18, LSB_PYTHON, scripts\import_excel.py, .xlsx format, and logs. |
| Remote access fails only | CORS/subnet/firewall or name resolution | Verify CORS_SUBNET CIDR, inbound rule, client route, and server DNS. |

## 15.1 Evidence to collect

- Timestamp, client name/IP, application server name/IP, selected station/date, and exact action.

- HTTP status and response from /health and the failing /api endpoint (remove credentials).

- Relevant server log lines and Windows Event Viewer service messages.

- Database error number/message and the object being queried; never capture passwords.

- Screenshot of the symptom with confidential production data minimized.

# 16. Security and Data Protection

- Use unique service accounts and least privilege for each database.

- Restrict config\.env ACLs; do not commit, email, or attach it to tickets.

- Restrict TCP 3001 to the plant LAN; prefer HTTPS through an approved reverse proxy.

- Patch Windows, browsers, PostgreSQL, SQL Server drivers, Go runtime/build tooling, and container images under change control.

- Review OEE entries, issue creation, confirmations, and downtime writes for traceability.

- Back up operational data and test recovery; do not use podman compose down -v unless deletion is intended and authorized.

- Do not expose the local pgAdmin defaults beyond localhost; change all default development passwords.

# 17. Local Development with Podman

The repository includes a PostgreSQL 17 and pgAdmin overlay for local development. Because the base compose file currently references a missing backend-java directory, use the database-only command first and resolve the compose dependency before attempting the full stack.

```
podman compose -f docker-compose.yml -f docker-compose.local-db.yml up -d postgres pgadmin
```

| **Service** | **Local address** | **Notes** |
| --- | --- | --- |
| pgAdmin | http://localhost:5050 | Bound to loopback only |
| PostgreSQL from Windows | localhost:55432 | Container port 5432 |
| PostgreSQL in compose network | postgres:5432 | Use service name as host |
| Go API (when available) | http://localhost:3001 | Base API |
| Vite frontend (when available) | http://localhost:5173 | Development UI |

**DATA LOSS  **The lsb-postgres-data volume preserves local data. Do not run a compose down command with -v unless you are intentionally deleting the database and have an approved backup.

# 18. Final Go-Live Sign-Off

| **Approval** | **Name / date** | **Signature** |
| --- | --- | --- |
| Plant IT |  |  |
| Database administrator |  |  |
| Cybersecurity |  |  |
| Production owner |  |  |
| Quality / maintenance |  |  |

- All Section 13 gaps have documented disposition.

- Section 9 tests pass from both server and remote plant client.

- Backup, rollback, support owner, and maintenance window are recorded.

- Operators have completed demo-mode training before live write access.

# Appendix A - Repository Sources Used

DEPLOYMENT.md - Windows service and deployment commands

LOCAL_DATABASE.md - Podman PostgreSQL and pgAdmin workflow

USER_GUIDE.md - User roles, tab descriptions, and alert behavior

config/.env.example - Current runtime variable names

frontend/src/App.jsx - Tabs, date navigation, refresh interval, and status behavior

frontend/src/components/SetupScreen.jsx - First-run workflow and connection fields

frontend/src/api/client.js - Frontend endpoint contracts

backend-go/main.go and backend-go/setup.go - Live server routes and database configuration

backend-go/db/schema.sql - Operational schema currently provided

backend-go/handlers/*.go - Production, issue, downtime, health, and MARS query behavior

exe/main.go and internal/deployment/deployment.go - Standalone executable modes and setup behavior

docker-compose*.yml and Makefile - Local build and container topology

# Appendix B - Detailed Troubleshooting Runbook

Use this runbook when the dashboard, API, database connection, service, or data-entry function is not working as expected. Perform checks in order and stop when the cause is identified.

**SAFETY FIRST  **Do not restart production equipment, modify PLC/robot settings, change database schemas, delete data, disable security controls, or reboot shared plant infrastructure under this application troubleshooting procedure.

## B.1 Classify the impact

| **Priority** | **Example** | **Immediate response** |
| --- | --- | --- |
| P1 - Plant impact | Dashboard action could affect safety, production data integrity, or multiple lines; suspected compromise | Stop write actions, preserve evidence, notify Plant IT and production leadership immediately. |
| P2 - Major | All users cannot connect, service is down, or live data is unavailable | Begin server/network checks; escalate if not restored within the site target. |
| P3 - Limited | One tab, station, user, or write action fails | Capture exact scope; compare a working station/client; troubleshoot the affected layer. |
| P4 - Minor | Cosmetic, printing, or historical-view issue with no operational impact | Record defect and workaround; schedule correction under change control. |

## B.2 First 10-minute response

Record the time, affected user/device, URL, selected station/date, visible error, and the last known working time.

Check whether the issue affects one browser, one workstation, one station, or every user.

Do not repeatedly submit Confirm, Raise Issue, Downtime, or OEE forms; duplicate writes may occur even when the screen reports an error.

Open http://<server>:3001/health and capture the response.

On the server, check the LSB-Go service and whether TCP 3001 is listening.

Check recent application logs before restarting anything.

If read-only pages work, test PostgreSQL and SQL Server separately to identify the failing data layer.

Use a controlled restart only after evidence is captured and only when operational ownership permits it.

```
sc.exe query LSB-Go
Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue
Invoke-RestMethod http://localhost:3001/health
```

## B.3 Health-response interpretation

| **Health result** | **Meaning** | **Next action** |
| --- | --- | --- |
| Connection refused / timeout | No listener, firewall, routing, or server unavailable | Check service, port listener, server IP/DNS, and firewall in that order. |
| status: unconfigured | LSB_MODE is missing/unconfigured or the wrong config file loaded | Verify config path and service working directory; do not enter secrets into the browser until deployment is validated. |
| status: ok; mode: mock | Application is serving simulated data | Use for training only. If live data is expected, stop and correct approved configuration. |
| status: ok; mode: production; mssql: unreachable | Web server is up but SQL Server connection is not healthy | Test SQL port/login/TLS and review server logs. |
| Health works; dashboard blank | Frontend static assets, cache, or JavaScript failure | Test static files, hard refresh, browser console, and service working directory. |
| Health works; API ERROR footer | At least one core data request failed | Call the failing /api endpoint directly and inspect database/log errors. |

## B.4 Service will not start

- **1. Confirm binary: **backend-go\lsb-api.exe exists and is the intended live server build.

- **2. Confirm path: **Run the executable manually from backend-go. Relative config/static paths can fail when launched by sc.exe.

- **3. Confirm port: **Check whether another process already owns TCP 3001.

- **4. Confirm configuration: **Verify config\.env exists, contains valid keys, and is readable by the service identity.

- **5. Confirm PostgreSQL: **When DB_HOST is set, an unreachable PostgreSQL database can terminate the server during startup.

- **6. Check events/logs: **Review configured LOG_FILE, console output, and Windows System/Application event logs.

```
sc.exe qc LSB-Go
sc.exe queryex LSB-Go
Get-Process -Id <PID> -ErrorAction SilentlyContinue
Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue
Get-WinEvent -LogName System -MaxEvents 100 | Where-Object Message -Match 'LSB-Go'
```

**RESTART LIMIT  **If the service fails again after one controlled restart, stop retrying. Repeated restarts can overwrite useful logs and conceal the original failure.

## B.5 Browser or remote-access issue

| **Check** | **How** | **Expected** |
| --- | --- | --- |
| Local server access | Open http://localhost:3001 on the server | Dashboard or health response loads |
| Name resolution | Resolve-DnsName <server-name> | Correct application-server IP |
| Port reachability | Test-NetConnection <server> -Port 3001 | TcpTestSucceeded: True |
| Correct URL | Use http://server:3001 unless an HTTPS proxy is approved | No old hostname/port/bookmark |
| Browser cache | Use Ctrl+F5 or an InPrivate/InPrivate window | Current static assets load |
| CORS subnet | Review CORS_SUBNET in config | Client IP belongs to the approved CIDR |

- If localhost works but remote clients fail, focus on Windows Firewall, network ACLs, DNS, CORS_SUBNET, and proxy configuration.

- If one client fails and another works, compare URL, DNS result, browser extensions, proxy, certificate trust, and system time.

- Do not disable the firewall as a test. Add or validate a narrowly scoped inbound rule for TCP 3001 from the plant subnet.

## B.6 PostgreSQL troubleshooting

```
Test-NetConnection POSTGRES01 -Port 5432
psql -h POSTGRES01 -p 5432 -U <service_account> -d lsb_oee -c 'select now();'
psql -h POSTGRES01 -p 5432 -U <service_account> -d lsb_oee -c '\dt'
```

| **Symptom** | **Check** |
| --- | --- |
| Server exits at startup | Host/port/database/user/password, pg_hba.conf, listener, firewall, TLS policy, and service-account rights. |
| KPIs empty | production_log rows for the exact resource, shift_num, and server date; PROD_TABLE value; server time zone. |
| Issues fail | ISSUES_TABLE points to issues; required columns and SELECT/INSERT privileges exist. |
| Downtime fails | DT_TABLE exists with the columns documented in Section 6.1; SELECT/INSERT privileges are granted. |
| Confirm does not persist | UPDATE privilege, matching resource/shift/date/hour row, and OPERATOR_NAME configuration. |
| OEE save fails | oee_entries schema, numeric values, INSERT privilege, and database free space. |

**TIME ALIGNMENT  **Several handlers use the application server's current date instead of the selected browser date. Verify Windows time, time zone, database time, and event timestamps when today's data appears empty.

## B.7 SQL Server / MARS troubleshooting

```
Test-NetConnection SQLSERVER01 -Port 1433
Invoke-Sqlcmd -ServerInstance 'SQLSERVER01,1433' -Database 'MARS_PROD' -Query 'SELECT GETDATE();'
```

- Verify LSB_DB_SERVER, LSB_DB_PORT, LSB_DB_NAME, and LSB_DB_USER. Never print or paste LSB_DB_PASSWORD into a ticket.

- Confirm SQL authentication is enabled when a SQL login is used and that the login is mapped to the target database.

- Review encryption and certificate errors. TrustServerCertificate=true is a temporary compatibility setting, not a substitute for managed certificates.

- Confirm approved objects and columns exist: dbo.ProductionLog, dbo.ShippingLog, dbo.DowntimeLog, and their referenced fields.

- Run queries with the same least-privilege account as the application. A DBA/sysadmin test can hide missing runtime permissions.

- If queries are slow, record duration and execution plan with the DBA; do not add indexes directly in production under this work instruction.

## B.8 Function-specific issues

| **Function** | **Troubleshooting steps** |
| --- | --- |
| Station selection | Confirm /api/stations returns expected identifiers. Compare identifier spelling/case with production_log and MARS data. |
| Historical view | Call endpoint with date parameter. If response still reflects today, record a defect; some current handlers ignore the selected date. |
| Alerts do not sound | Interact with the page once, allow audio/notification permission, confirm alert criteria, and check mute/device output. |
| Issue status/notes disappear | Current detail status and notes may use browser local storage. Check the same browser profile and confirm the official system of record. |
| Downtime action disappears | Category action text is browser-local. Confirm local storage is permitted and not cleared; record official action elsewhere. |
| Excel import fails | Use .xlsx under 50 MB; verify ODBC Driver 18, Python path, importer script, SQL permissions, and importer output. |
| Printing is incomplete | Use print preview, landscape when needed, 100% or Fit to page, and confirm browser headers/footers policy. |
| AI Health unavailable | Core dashboard can operate without LLM. Check LLM config/API key/network separately and do not expose the key. |

## B.9 Safe restart and recovery

Tell the production supervisor that the dashboard will be unavailable and identify the temporary manual process.

Capture /health, logs, service state, and the exact error before restart.

Stop LSB-Go and verify TCP 3001 is no longer listening.

Start LSB-Go once, then verify service state, port, /health, dashboard root, one read endpoint, and one approved write test.

If the issue remains, stop. Restore the last approved binary/static package and preserved config, then repeat commissioning checks.

Reconcile any manual production, downtime, issue, or OEE records entered during the outage before closing the incident.

```
net stop LSB-Go
Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue
net start LSB-Go
sc.exe query LSB-Go
Invoke-RestMethod http://localhost:3001/health
```

## B.10 When to escalate

- Any safety concern, suspected cybersecurity event, unauthorized data exposure, or unexpected write to MARS/production data.

- Repeated service crash, database corruption/error, disk-full condition, or failed rollback.

- Multiple lines affected, no reliable manual fallback, or outage beyond the site's response target.

- Schema/object mismatch requiring database modification, new firewall exposure, certificate change, or elevated privileges.

- Evidence that displayed production, quality, downtime, shipping, or OEE values are inaccurate.

## B.11 Incident handoff template

| **Field** | **Record** |
| --- | --- |
| Incident number / priority | ____________________________________________ |
| Start time / last known good | ____________________________________________ |
| Reported by / contact | ____________________________________________ |
| Affected users, lines, stations | ____________________________________________ |
| Server / client / URL | ____________________________________________ |
| Exact symptom and error | ____________________________________________ |
| Health response | ____________________________________________ |
| Service and port state | ____________________________________________ |
| Database tests | ____________________________________________ |
| Changes or restart performed | ____________________________________________ |
| Workaround / production impact | ____________________________________________ |
| Evidence location | ____________________________________________ |
| Next owner / next action | ____________________________________________ |

**EVIDENCE RULE  **Remove or mask passwords, API keys, connection strings, employee personal data, and confidential production details before sharing diagnostics outside the approved support group.

_End of work instruction_

## Related Documents

- [[192.168.1.1 - wbshocket findings|192.168.1.1 Wbshocket Findings]]
- [[DRISHTI-NOC-Audit-Report|DRISHTI NOC Audit Report]]
- [[DRISHTI_NOC_Codex_Remediation_Steps|DRISHTI NOC Codex Remediation Steps]]
- [[DRISHTI_NOC_Codex_Remediation_Steps|DRISHTI NOC Codex Remediation Steps]]
- [[DRISHTI_NOC_Codex_Remediation_Steps|DRISHTI NOC Codex Remediation Steps]]
- [[DRISHTI_NOC_Multi_Plant_Federation_Project_Plan|DRISHTI NOC Multi Plant Federation Project Plan]]
- [[DRISHTI_NOC_Multi_Plant_Federation_Project_Plan|DRISHTI NOC Multi Plant Federation Project Plan]]
- [[DRISHTI-RiskAssesment_Phased_Codex_Build_Plan|DRISHTI Riskassesment Phased Codex Build Plan]]
- [[DRISHTI_Server_Hardening_Report|DRISHTI Server Hardening Report]]
- [[DRISHTI_SiteOps_Agent_Brief|DRISHTI Siteops Agent Brief]]
- [[WI-09-Podman-Desktop-on-Windows-VMware|WI 09 Podman Desktop On Windows Vmware]]
- [[WI-10-Windows-Installer-Workspace-Capacity|WI 10 Windows Installer Workspace Capacity]]
- [[WI-11-Native-Windows-Installation|WI 11 Native Windows Installation]]
- [[WI-IT-OT-001_FleetManager_Server_Build_Standard_v1.0|WI IT OT 001 Fleetmanager Server Build Standard V1.0]]
- [[WI-IT-SEC-001_Ubuntu_Base_Image_Security_Hardening_Standard_v1.0|WI IT SEC 001 Ubuntu Base Image Security Hardening Standard V1.0]]
- [[WI-IT-SEC-001_Ubuntu_Base_Image_Security_Hardening_Standard_v1.0|WI IT SEC 001 Ubuntu Base Image Security Hardening Standard V1.0]]
