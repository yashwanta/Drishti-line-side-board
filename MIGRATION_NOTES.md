# LSB Java-to-Go Migration Notes

Migration date: 2026-08-09

## Deployment result

- Removed the LSB-Java service, the `mars-service-2.0.0.jar` artifact, the JRE dependency, and Maven from the production deployment.
- Added the `github.com/microsoft/go-mssqldb` driver to LSB-Go so it connects directly to the MARS SQL Server.
- The deployment now uses one binary: `backend-go\lsb-api.exe`.
- The deployment now runs one service: LSB-Go only, on port 3001.
- Port 8080 is no longer used and can be closed in the plant firewall.

## MARS MSSQL tables used by handlers

- `dbo.ProductionLog` — used by stations, production status, and weekly production handlers.
- `dbo.ShippingLog` — used by the shipping status handler. **TODO: confirm the table and column names with the DBA.**
- `dbo.DowntimeLog` — used by the downtime handler. **TODO: confirm the table and column names with the DBA.**
- Robot press table — not yet configured. **TODO: obtain the MARS robot press table and column names from the DBA.**

## Known follow-up item

`backend-go/handlers/robotpress.go` intentionally returns HTTP 503 because the MARS robot press table name has not been confirmed. This will be addressed in a follow-up task after DBA confirmation.
