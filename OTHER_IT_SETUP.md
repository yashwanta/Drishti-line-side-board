# Other IT Laptop Setup

This procedure prepares a Windows IT laptop for Line Side Board demo-mode development. Demo mode does not require Podman or a database. Add Podman only when the developer needs a local PostgreSQL database.

## 1. Install Git

Open PowerShell and run:

```powershell
winget install --exact --id Git.Git --accept-package-agreements --accept-source-agreements
```

Close PowerShell and open a new window after Git installation.

## 2. Clone and create a personal branch

```powershell
git clone https://github.com/yashwanta/Drishti-line-side-board.git
cd Drishti-line-side-board
git switch -c feature/<name>-<task>
```

The developer needs GitHub collaborator access to push a branch. If the starting work exists on another remote branch, create the personal branch from it instead of `main`:

```powershell
git fetch origin
git switch -c feature/<name>-<task> origin/<starting-branch>
```

## 3. Install dependencies and build demo mode

From the repository root:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup-windows-dev.ps1
```

The script installs or verifies Git, Go, Node.js LTS, Python, JavaScript packages, Go modules, and the optional Excel-import Python packages. It creates the ignored `config\.env`, selects mock mode, builds the frontend, builds `lsb-dashboard.exe`, and runs the Go tests.

Run the demo:

```powershell
.\lsb-dashboard.exe
```

Open:

- Dashboard: http://localhost:3001
- Health check: http://localhost:3001/health

The health response should report `mock` mode.

## 4. Optional local PostgreSQL with Podman

Podman requires hardware virtualization and WSL 2. To install and initialize it along with the other dependencies:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup-windows-dev.ps1 -WithPodman
```

A reboot may be required when WSL 2 or virtualization components are first enabled. Rerun the setup script after the reboot.

Start only PostgreSQL and pgAdmin:

```powershell
podman compose -f docker-compose.yml -f docker-compose.local-db.yml up -d postgres pgadmin
```

Local services:

- PostgreSQL: `localhost:55432`
- pgAdmin: http://localhost:5050

The passwords in the local Compose defaults are for isolated development only. Do not use them in production.

## 5. Push the personal branch

Add only intended source files. Do not commit `config\.env`, API keys, database passwords, logs, generated builds, or executables.

```powershell
git status
git add <specific-files>
git commit -m "Describe the change"
git push -u origin feature/<name>-<task>
```

Open a pull request instead of committing directly to `main`.
