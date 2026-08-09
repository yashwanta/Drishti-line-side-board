# Line Side Board — Windows Production Deployment

## Prerequisites

- Go 1.21 or newer (build only, not needed on the plant server)
- PostgreSQL 15 or newer
- Microsoft ODBC Driver 18 for SQL Server

No third-party service manager is needed. `sc.exe` is included with every Windows installation since Windows XP. No download or installation is required.

Port 8080 is no longer used. If previously opened in the firewall, it can be closed.

## Build

Build the production executable from the project root:

```powershell
go build -o backend-go\lsb-api.exe .\exe\
```

The plant server needs only the resulting executable and runtime configuration; the Go toolchain is not required there.

## Installation

1. Fill `config\.env` with the real MARS SQL Server and PostgreSQL connection values. Do not leave placeholder credentials in production.
2. Initialize the PostgreSQL operational database:

   ```powershell
   psql -U lsb_admin -d lsb_oee -f backend-go\db\schema.sql
   ```

3. From an elevated Command Prompt, install and start the Windows service:

   ```bat
   install-service.bat
   ```

   The script uses `sc.exe`, which is built into Windows. No service-manager download or `PATH` setup is required.

4. Open `http://localhost:3001` and verify that the dashboard reports production mode and live data.

## Service Status

Run this command from an elevated Command Prompt:

```bat
sc.exe query LSB-Go
```

Expected: `STATE : 4  RUNNING`

## Service Management Quick Reference

| Task | Command |
|---|---|
| Check status | `sc.exe query LSB-Go` |
| Start service | `net start LSB-Go` |
| Stop service | `net stop LSB-Go` |
| Remove service | `uninstall-service.bat` |
| View log | `type logs\lsb-go.log` |
| Stream log | `Get-Content logs\lsb-go.log -Wait` (PowerShell) |

## Logs

Service logs are stored in the project's `logs` directory:

- `logs\lsb-go.log` — service standard output
- `logs\lsb-go-error.log` — service errors

Check these files first if the service fails to start or repeatedly restarts.

## Updating the Application

1. Stop the service:

   ```bat
   net stop LSB-Go
   ```

2. Replace only `backend-go\lsb-api.exe`. Preserve the production `config\.env` file.
3. Start the service:

   ```bat
   net start LSB-Go
   ```

4. Recheck service status, logs, `http://localhost:3001/health`, and the dashboard.

## Removing the Service

Run from an elevated Command Prompt:

```bat
uninstall-service.bat
```

This removes one service, LSB-Go, only.
