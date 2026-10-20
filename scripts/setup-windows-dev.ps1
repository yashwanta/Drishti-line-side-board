[CmdletBinding()]
param(
    [switch]$WithPodman,
    [switch]$SkipTests
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repoRoot = Split-Path -Parent $PSScriptRoot
$frontendDir = Join-Path $repoRoot 'frontend'
$backendDir = Join-Path $repoRoot 'backend-go'
$configExample = Join-Path $repoRoot 'config\.env.example'
$configFile = Join-Path $repoRoot 'config\.env'
$demoExecutable = Join-Path $repoRoot 'lsb-dashboard.exe'

function Refresh-ProcessPath {
    $machinePath = [Environment]::GetEnvironmentVariable('Path', 'Machine')
    $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
    $env:Path = "$machinePath;$userPath"
}

function Install-Tool {
    param(
        [Parameter(Mandatory)] [string]$Command,
        [Parameter(Mandatory)] [string]$PackageId,
        [Parameter(Mandatory)] [string]$DisplayName
    )

    if (Get-Command $Command -ErrorAction SilentlyContinue) {
        Write-Host "$DisplayName is already installed." -ForegroundColor Green
        return
    }

    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
        throw 'Windows Package Manager (winget) is unavailable. Install Microsoft App Installer, reopen PowerShell, and retry.'
    }

    Write-Host "Installing $DisplayName..." -ForegroundColor Cyan
    & winget install --exact --id $PackageId --accept-package-agreements --accept-source-agreements
    if ($LASTEXITCODE -ne 0) {
        throw "$DisplayName installation failed with exit code $LASTEXITCODE."
    }

    Refresh-ProcessPath
    if (-not (Get-Command $Command -ErrorAction SilentlyContinue)) {
        throw "$DisplayName was installed but is not visible in this terminal. Reopen PowerShell and run this script again."
    }
}

function Invoke-InDirectory {
    param(
        [Parameter(Mandatory)] [string]$Path,
        [Parameter(Mandatory)] [scriptblock]$Action
    )

    Push-Location $Path
    try {
        & $Action
        if ($LASTEXITCODE -ne 0) {
            throw "Command failed in $Path with exit code $LASTEXITCODE."
        }
    }
    finally {
        Pop-Location
    }
}

Write-Host 'Installing/verifying the Drishti Line Side Board development toolchain...' -ForegroundColor Cyan

Install-Tool -Command git -PackageId 'Git.Git' -DisplayName 'Git'
Install-Tool -Command go -PackageId 'GoLang.Go' -DisplayName 'Go'
Install-Tool -Command node -PackageId 'OpenJS.NodeJS.LTS' -DisplayName 'Node.js LTS'
Install-Tool -Command python -PackageId 'Python.Python.3.14' -DisplayName 'Python 3.14'

Write-Host 'Installing frontend packages...' -ForegroundColor Cyan
Invoke-InDirectory -Path $frontendDir -Action { npm ci }

Write-Host 'Downloading Go modules...' -ForegroundColor Cyan
Invoke-InDirectory -Path $repoRoot -Action { go mod download }
Invoke-InDirectory -Path $backendDir -Action { go mod download }

Write-Host 'Installing Excel-import Python packages...' -ForegroundColor Cyan
& python -m pip install --user openpyxl pyodbc
if ($LASTEXITCODE -ne 0) {
    throw "Python dependency installation failed with exit code $LASTEXITCODE."
}

if (-not (Test-Path -LiteralPath $configFile)) {
    Copy-Item -LiteralPath $configExample -Destination $configFile
    $configText = Get-Content -LiteralPath $configFile -Raw
    if ($configText -match '(?m)^LSB_MODE=') {
        $configText = [regex]::Replace($configText, '(?m)^LSB_MODE=.*$', 'LSB_MODE=mock')
    }
    else {
        $configText = "LSB_MODE=mock`r`n$configText"
    }
    [System.IO.File]::WriteAllText($configFile, $configText)
    Write-Host 'Created config\.env from the safe example.' -ForegroundColor Green
}
else {
    Write-Host 'Existing config\.env was preserved. Confirm LSB_MODE=mock before starting a demo.' -ForegroundColor Yellow
}

Write-Host 'Building the frontend and demo executable...' -ForegroundColor Cyan
Invoke-InDirectory -Path $frontendDir -Action { npm run build }
Invoke-InDirectory -Path $repoRoot -Action { go build -o $demoExecutable .\exe }

if (-not $SkipTests) {
    Write-Host 'Running Go tests...' -ForegroundColor Cyan
    Invoke-InDirectory -Path $repoRoot -Action { go test ./... }
    Invoke-InDirectory -Path $backendDir -Action { go test ./... }
}

if ($WithPodman) {
    Install-Tool -Command podman -PackageId 'RedHat.Podman' -DisplayName 'Podman'

    Write-Host 'Installing the Podman Compose provider...' -ForegroundColor Cyan
    & python -m pip install --user podman-compose
    if ($LASTEXITCODE -ne 0) {
        throw "podman-compose installation failed with exit code $LASTEXITCODE."
    }

    $pythonUserSite = (& python -c 'import site; print(site.getusersitepackages())').Trim()
    $pythonScripts = Join-Path (Split-Path -Parent $pythonUserSite) 'Scripts'
    $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
    $userEntries = @($userPath -split ';' | Where-Object { $_ })
    if ($userEntries -notcontains $pythonScripts) {
        [Environment]::SetEnvironmentVariable('Path', (($userEntries + $pythonScripts) -join ';'), 'User')
    }
    Refresh-ProcessPath

    & podman machine inspect podman-machine-default *> $null
    if ($LASTEXITCODE -ne 0) {
        Write-Host 'Creating the Podman WSL machine...' -ForegroundColor Cyan
        & podman machine init --cpus 4 --memory 4096 --disk-size 50
        if ($LASTEXITCODE -ne 0) {
            throw 'Podman machine creation failed. Confirm virtualization and WSL 2 are enabled, reboot if requested, and rerun the script.'
        }
    }

    & podman machine start
    if ($LASTEXITCODE -ne 0) {
        & podman info *> $null
        if ($LASTEXITCODE -ne 0) {
            throw 'Podman machine failed to start.'
        }
    }

    & podman compose -f (Join-Path $repoRoot 'docker-compose.yml') -f (Join-Path $repoRoot 'docker-compose.local-db.yml') config --services
    if ($LASTEXITCODE -ne 0) {
        throw 'Podman Compose validation failed.'
    }
}

Write-Host ''
Write-Host 'Setup completed successfully.' -ForegroundColor Green
Write-Host "Demo executable: $demoExecutable"
Write-Host 'Run it, then open http://localhost:3001 in Chrome or Edge.'
Write-Host 'Create a personal branch before editing: git switch -c feature/<name>-<task>'
if ($WithPodman) {
    Write-Host 'Podman is ready. The local database containers have not been started.'
}
