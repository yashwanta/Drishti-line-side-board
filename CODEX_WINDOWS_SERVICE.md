# CODEX TASK — Native Go Windows Service (remove NSSM dependency)
#
# Goal: make lsb-api.exe register and run as a native Windows service
#       using Microsoft's own golang.org/x/sys/windows/svc package.
#       No NSSM, no WinSW, no third-party tools.
#       Management uses sc.exe which is built into every Windows install.
#
# PHASES:
#   Phase A — Add Windows service support to the Go binary
#   Phase B — Update install/uninstall scripts and documentation
#
# Give Codex ONE phase at a time.
# Wait for go build ./... to pass before giving the next phase.

---

## PHASE A — Add Windows service support to the Go binary

Paste this to Codex:

```
Read CODEX_WINDOWS_SERVICE.md for full context on what we are doing.

Before writing any code, read these files:
  - exe/main.go          (entry point — this is where service logic goes)
  - backend-go/main.go   (HTTP server setup — understand how it starts)
  - go.mod               (check current Go version and dependencies)

Goal: make lsb-api.exe detect whether it is being launched by the
Windows Service Control Manager (SCM) or run directly in a terminal,
and behave correctly in both cases.

### PHASE A tasks:

1. Add the Windows service dependency:
   Run: go get golang.org/x/sys@latest
   This provides the windows/svc package used below.

2. Create exe/winsvc.go
   This file contains the Windows service handler and must build ONLY
   on Windows. Use a build constraint at the top of the file:
     //go:build windows

   The file must implement:

   a) A type that satisfies the svc.Handler interface:
        type lsbService struct{}
        func (s *lsbService) Execute(
            args []string,
            r <-chan svc.ChangeRequest,
            changes chan<- svc.Status,
        ) (bool, uint32) {
            // Signal that the service has started
            changes <- svc.Status{State: svc.Running, Accepts: svc.AcceptStop | svc.AcceptShutdown}
            // Listen for stop/shutdown signals from SCM
            for {
                select {
                case c := <-r:
                    switch c.Cmd {
                    case svc.Stop, svc.Shutdown:
                        changes <- svc.Status{State: svc.StopPending}
                        return false, 0
                    }
                }
            }
        }

   b) A RunAsService() function:
        func RunAsService(serviceName string) error {
            return svc.Run(serviceName, &lsbService{})
        }

   c) An IsWindowsService() function:
        func IsWindowsService() (bool, error) {
            return svc.IsWindowsService()
        }

   Imports needed: golang.org/x/sys/windows/svc

3. Update exe/main.go
   The current main() starts the HTTP server directly.
   Change it to:

   a) Call IsWindowsService() first. If there is an error, log it and
      start normally (fail-safe: never block startup because of service check).

   b) If running as a Windows service:
      - Start the HTTP server in a background goroutine
        (the HTTP server's ListenAndServe must NOT block the service handler)
      - Call RunAsService("LSB-Go") — this blocks until SCM sends stop signal
      - When RunAsService returns, trigger a graceful HTTP server shutdown
        using http.Server.Shutdown() with a 10-second timeout

   c) If NOT running as a Windows service (normal terminal run):
      - Start the HTTP server exactly as it does today (no change in behaviour)
      - The dev experience must be identical to before this change

   d) Add a shutdown channel or context so the HTTP server and the service
      handler can coordinate graceful stop cleanly.

   Imports needed in exe/main.go:
     - context
     - os/signal (for terminal CTRL+C handling when NOT a service)
     - syscall (for SIGINT/SIGTERM)
     - golang.org/x/sys/windows/svc (via the winsvc.go wrapper)

4. Handle CTRL+C gracefully when running in terminal (non-service mode):
   When NOT running as a service, listen for os.Interrupt and syscall.SIGTERM
   and call http.Server.Shutdown() with a 5-second timeout.
   This is standard practice and improves the dev experience.

5. Log clearly on startup using slog:
   - If starting as a Windows service:
       slog.Info("starting as Windows service", "name", "LSB-Go")
   - If starting in terminal mode:
       slog.Info("starting in terminal mode")

### Build constraint for non-Windows:
   winsvc.go must only compile on Windows (build constraint at top).
   Create exe/winsvc_stub.go with the opposite build constraint:
     //go:build !windows
   This file provides stub implementations of RunAsService and
   IsWindowsService that return (false, nil) so the code compiles
   on Linux and macOS without modification.

### After all changes:
   Run: go build ./...
   Fix any errors before reporting done.
   Run: go test ./...
   Paste: build output, test output, and list of every file created or changed.
   Confirm: the binary still starts normally when run directly in PowerShell
   (run .\backend-go\lsb-api.exe and confirm it listens on port 3001).
```

---

## PHASE B — Update install/uninstall scripts and documentation

Paste this to Codex AFTER Phase A passes and the binary runs correctly:

```
Read CODEX_WINDOWS_SERVICE.md for full context.

Before making any changes, read:
  - install-service.bat
  - uninstall-service.bat
  - DEPLOYMENT.md

Phase A is complete — lsb-api.exe now supports native Windows service mode.
We are replacing all NSSM commands with sc.exe which is built into Windows.

### PHASE B tasks:

1. Rewrite install-service.bat completely:

   @echo off
   setlocal

   REM Require Administrator
   net session >nul 2>&1
   if errorlevel 1 (
       echo ERROR: Run this script from an elevated Administrator prompt.
       exit /b 1
   )

   echo Make sure config\.env is filled with real values before continuing.
   pause

   if not exist "%~dp0logs" mkdir "%~dp0logs"

   echo Installing LSB-Go as a Windows service...
   sc.exe create LSB-Go ^
       binPath= "\"%~dp0backend-go\lsb-api.exe\"" ^
       start= auto ^
       DisplayName= "Line Side Board API"

   if errorlevel 1 (
       echo ERROR: sc.exe create failed. The service may already exist.
       echo Run uninstall-service.bat first, then retry.
       exit /b 1
   )

   sc.exe description LSB-Go "Line Side Board — plant dashboard API and OEE data service"

   REM Restart automatically: restart after 10s on first failure,
   REM 10s on second, 10s on all subsequent. Reset counter after 1 day.
   sc.exe failure LSB-Go reset= 86400 actions= restart/10000/restart/10000/restart/10000

   sc.exe start LSB-Go
   if errorlevel 1 (
       echo ERROR: Service failed to start. Check logs\lsb-go-error.log
       exit /b 1
   )

   echo.
   echo Done. LSB-Go service installed and running.
   echo Open http://localhost:3001 to verify.
   echo.
   echo To check status:   sc.exe query LSB-Go
   echo To stop service:   net stop LSB-Go
   echo To start service:  net start LSB-Go
   endlocal

   IMPORTANT NOTES for the binPath= line:
   - There must be a SPACE after the equals sign in sc.exe parameters
     (sc.exe create requires: binPath= "..." not binPath="...")
   - The path to lsb-api.exe must be the full absolute path, not a
     relative path, because sc.exe runs services from System32 context.
   - Use %~dp0 to get the full path of the batch file directory.
   - The path must be quoted inside the binPath value if it contains spaces.

2. Rewrite uninstall-service.bat:

   @echo off
   setlocal

   net session >nul 2>&1
   if errorlevel 1 (
       echo ERROR: Run this script from an elevated Administrator prompt.
       exit /b 1
   )

   echo Stopping LSB-Go...
   net stop LSB-Go 2>nul

   echo Removing LSB-Go service...
   sc.exe delete LSB-Go

   if errorlevel 1 (
       echo WARNING: sc.exe delete returned an error.
       echo The service may not have been installed, or a reboot may be needed.
   ) else (
       echo LSB-Go service removed successfully.
   )
   endlocal

3. Update DEPLOYMENT.md:

   a) Prerequisites section — remove NSSM entirely. Final list:
        - Go 1.21 or newer (build only, not needed on plant server)
        - PostgreSQL 15 or newer
        - Microsoft ODBC Driver 18 for SQL Server
      No third-party service manager needed.

   b) Installation section — replace the NSSM install step with sc.exe:
      The install-service.bat script now uses sc.exe (built into Windows).
      No NSSM download or PATH setup required.

   c) Service Status section — update commands:
        sc.exe query LSB-Go
      Expected: STATE : 4  RUNNING

   d) Service management quick reference — add this table:
        | Task           | Command                    |
        |----------------|----------------------------|
        | Check status   | sc.exe query LSB-Go        |
        | Start service  | net start LSB-Go           |
        | Stop service   | net stop LSB-Go            |
        | Remove service | uninstall-service.bat      |
        | View log       | type logs\lsb-go.log       |
        | Stream log     | (use PowerShell Get-Content logs\lsb-go.log -Wait) |

   e) Remove all NSSM references including:
      - Any mention of "NSSM" or "nssm"
      - Any mention of AppStdout, AppStderr, AppRestartDelay (NSSM-specific)
      - The note about adding NSSM to PATH

4. Confirm sc.exe is really built into Windows — add this note to DEPLOYMENT.md:
   "sc.exe is included with every Windows installation since Windows XP.
    No download or installation is required."

### After all changes:
   Paste: the full content of the new install-service.bat
   Paste: the full content of the new uninstall-service.bat
   Paste: the updated Prerequisites section from DEPLOYMENT.md
   Confirm: the word "nssm" does not appear anywhere in DEPLOYMENT.md
   Confirm: the word "nssm" does not appear in install-service.bat
```

---

## WHAT TO SAY TO CODEX

Phase A:
  "Read CODEX_WINDOWS_SERVICE.md and complete Phase A only. Do not start Phase B.
   Before writing anything, read exe/main.go, backend-go/main.go, and go.mod."

Phase B (after Phase A build passes):
  "Read CODEX_WINDOWS_SERVICE.md and complete Phase B only.
   Before making any changes, read install-service.bat, uninstall-service.bat,
   and DEPLOYMENT.md."

---

## HOW TO TEST AFTER BOTH PHASES COMPLETE

From an elevated PowerShell in C:\DRISHTI\Drishti-LineSideBoard:

  # Rebuild the binary
  go build -o backend-go\lsb-api.exe .\exe\

  # Install the service (no NSSM needed)
  .\install-service.bat

  # Verify running
  sc.exe query LSB-Go

  # Test endpoint
  Invoke-RestMethod http://localhost:3001/health

  # Stop and remove when done testing
  .\uninstall-service.bat

## WHAT CHANGES FOR PLANT DEPLOYMENT

Before: Need NSSM downloaded, extracted, copied to System32
After:  Nothing extra — sc.exe is already on every Windows machine

The work instruction (DEPLOYMENT.md) prerequisites drop from 4 items to 3.
