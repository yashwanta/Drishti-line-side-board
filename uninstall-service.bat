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
