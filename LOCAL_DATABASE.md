# Local Line Side Board database in Podman

This setup runs PostgreSQL 17 and pgAdmin on the work laptop while retaining
`docker-compose.yml` for the existing home-server database configuration.

## Start the local database and browser

From PowerShell in this project directory:

```powershell
podman compose -f docker-compose.yml -f docker-compose.local-db.yml up -d postgres pgadmin
```

Open pgAdmin at <http://localhost:5050>.

Default local-only login:

- Email: `admin@linesideboard.com`
- Password: `lsb-admin-change-me`

Register a server in pgAdmin using:

- Name: `LineSide Board`
- Host: `postgres`
- Port: `5432`
- Maintenance database: `mesdb`
- Username: `mesapp`
- Password: `lsb-local-change-me`

Change these defaults in a local `.env` file before using the setup for
anything beyond development.

## Copy the home-server database

The laptop must be able to reach `192.168.1.126:5432` (for example, while on
the home network or connected through a VPN).

Create a custom-format dump:

```powershell
podman run --rm -it -v "${PWD}:/backup" docker.io/library/postgres:17 pg_dump --host=192.168.1.126 --port=5432 --username=mesapp --dbname=mesdb --format=custom --file=/backup/mesdb.dump
```

Start local PostgreSQL if it is not already running:

```powershell
podman compose -f docker-compose.yml -f docker-compose.local-db.yml up -d postgres pgadmin
```

Copy the dump into the local container:

```powershell
podman cp .\mesdb.dump lsb-postgres:/backup/mesdb.dump
```

Restore the dump into the local container:

```powershell
podman exec -it lsb-postgres pg_restore --username=mesapp --dbname=mesdb --clean --if-exists /backup/mesdb.dump
```

Run the entire application against the laptop database:

```powershell
podman compose -f docker-compose.yml -f docker-compose.local-db.yml up --build -d
```

URLs:

- pgAdmin: <http://localhost:5050>
- Dashboard: <http://localhost:5173>
- Go API: <http://localhost:3001>

From database tools running directly on Windows (rather than inside the
Podman network), use host `localhost` and port `55432`.

The named volume `lsb-postgres-data` keeps database data when containers are
stopped or recreated. Do not use `down -v` unless you intend to erase it.
