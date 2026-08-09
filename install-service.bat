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
