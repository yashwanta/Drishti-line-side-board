# 📊 LINE SIDE BOARD — MES Digital Dashboard

> **Real-time shop floor production monitoring dashboard**  
> Built with Go · PostgreSQL 17 · HTML5 · Deployed on Proxmox LXC  
> Prepared by: **Yashwanta Thakur** — Plant IT / Cybersecurity

---

## 🖥️ What Is This?

The **Line Side Board (LSB)** is a digital replacement for the paper-based production tracking boards used on the shop floor. It connects directly to the **MES (Manufacturing Execution System)** PostgreSQL database and displays live production data for machine operators and supervisors.

### What It Shows
- ✅ Hourly production output vs. JPH (Jobs Per Hour) target
- ✅ Cumulative actual vs. plan accumulation across the shift
- ✅ Scrap count and First Pass Yield %
- ✅ Average cycle time per part
- ✅ Open quality/maintenance/safety issues
- ✅ Downtime events with reason codes and durations
- ✅ Operator hour confirmation (digital sign-off)
- ✅ Live productivity bar chart

---

## 🏗️ Architecture

```
Proxmox VE Host
└── LXC Container 205  (MES-PostgreSQL)
    IP: 192.168.1.126
    OS: Ubuntu 25.04
    │
    ├── PostgreSQL 17.7
    │   └── Database: mesdb
    │       ├── production_log    ← part events, good/scrap counts
    │       ├── downtime_log      ← start/end timestamps, reason codes
    │       └── open_issues       ← quality, safety, maintenance issues
    │
    ├── Go API Server  :3001
    │   └── /opt/lsb-api/lsb-api  (managed by PM2)
    │
    └── nginx  :80
        └── /var/www/lsb/index.html  (dashboard)

Shop Floor Access
├── Tablets    → http://192.168.1.126  (dashboard)
├── Office PCs → http://192.168.1.126  (dashboard)
└── IT/Dev     → http://192.168.1.126:3001/api/health
```

---

## 📁 Project Files

| File | Purpose |
|---|---|
| `main.go` | Go REST API server — all 8 endpoints |
| `go.mod` | Go module dependencies (PostgreSQL driver only) |
| `index.html` | Complete dashboard — single HTML file, no build needed |
| `.env.example` | Configuration template — copy to `.env` and fill in password |
| `.gitignore` | Excludes `.env`, binary, logs from Git |

---

## 🗄️ Database Schema

### `production_log`
| Column | Type | Description |
|---|---|---|
| `id` | bigint PK | Auto-increment |
| `event_ts` | timestamptz | When the part was produced |
| `resource_id` | text | Machine ID (e.g. WM15) |
| `part_number` | text | Part number (e.g. BMW1000D-360) |
| `operator_name` | text | Operator who logged it |
| `shift_number` | integer | 1, 2, or 3 |
| `good_count` | integer | Good parts in this event |
| `scrap_count` | integer | Scrapped parts in this event |
| `cycle_time_seconds` | numeric | Average cycle time |
| `notes` | text | Operator notes |
| `confirmed_by` | text | Who confirmed the hour *(added on startup)* |
| `confirmed_at` | timestamptz | When confirmed *(added on startup)* |

### `downtime_log`
| Column | Type | Description |
|---|---|---|
| `id` | bigint PK | Auto-increment |
| `start_ts` | timestamptz | When downtime started |
| `end_ts` | timestamptz | When downtime ended (NULL = still open) |
| `resource_id` | text | Machine ID |
| `reason_code` | text | PM, EQ, OP, MT, QA, CL, BK, OT |
| `reason_detail` | text | Free-text description |
| `operator_name` | text | Who logged it |

### `open_issues`
| Column | Type | Description |
|---|---|---|
| `id` | bigint PK | Auto-increment |
| `created_ts` | timestamptz | When issue was raised |
| `status` | text | `open` or `closed` |
| `severity` | text | `critical`, `high`, `medium`, `low` |
| `resource_id` | text | Machine ID |
| `issue_type` | text | Safety, Quality, Maintenance, Equipment |
| `description` | text | Full issue description |
| `acknowledged_by` | text | Who acknowledged it |
| `closed_ts` | timestamptz | When closed |

---

## 🔌 API Endpoints

Base URL: `http://192.168.1.126:3001/api`

| Method | Endpoint | Parameters | Description |
|---|---|---|---|
| GET | `/health` | — | Server + DB connection status |
| GET | `/production` | `resource`, `shift` | Hourly rows grouped by EXTRACT(HOUR) |
| GET | `/kpis` | `resource`, `shift` | Shift totals: good, scrap, efficiency, FPY |
| GET | `/productivity` | `resource`, `shift` | Per-hour good count vs JPH target |
| GET | `/issues` | `resource` | Open issues (status != closed) |
| GET | `/downtime` | `resource` | Today's downtime events |
| POST | `/confirm` | body JSON | Set confirmed_by + confirmed_at |
| POST | `/downtime` | body JSON | Insert new downtime event |

### POST /api/confirm
```json
{
  "resource":  "WM15",
  "hourStart": 15,
  "operator":  "Yashwanta Thakur"
}
```

### POST /api/downtime
```json
{
  "resource": "WM15",
  "code":     "EQ",
  "minutes":  15,
  "comment":  "Spindle alarm — reset and resumed",
  "operator": "Yashwanta Thakur"
}
```

### Downtime Reason Codes
| Code | Meaning |
|---|---|
| `PM` | Planned Maintenance |
| `EQ` | Equipment Failure |
| `OP` | Operator Issue |
| `MT` | Material / Setup |
| `QA` | Quality Hold |
| `CL` | Changeover |
| `BK` | Break |
| `OT` | Other |

---

## ⚙️ Configuration — .env File

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
nano .env
```

```env
# PostgreSQL Connection
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=mesdb
DB_USER=mesapp
DB_PASS=YourPasswordHere       ← fill this in

# API Server
PORT=3001
CORS_SUBNET=192.168.1.0        ← your plant network subnet

# MES / Plant
RESOURCE_ID=WM15
PART_NUMBER=BMW1000D-360
OPERATOR_NAME=Yashwanta Thakur
JPH_TARGET=23
SHIFT_NUM=2
POLL_MS=15000

# Table Names
PROD_TABLE=production_log
DT_TABLE=downtime_log
ISSUES_TABLE=open_issues
```

> ⚠️ **Never commit `.env` to Git** — it contains your database password.  
> The `.gitignore` already blocks it.

---

## 🚀 Installation & Deployment

### Prerequisites
- Ubuntu 22.04 / 24.04 / 25.04 (LXC or bare metal)
- Go 1.21+
- PostgreSQL 17 with `mesdb` database
- nginx
- PM2 (`npm install -g pm2`)

---

### 1. Install Go

```bash
wget https://go.dev/dl/go1.21.0.linux-amd64.tar.gz
tar -C /usr/local -xzf go1.21.0.linux-amd64.tar.gz
echo 'export PATH=$PATH:/usr/local/go/bin' >> ~/.bashrc
source ~/.bashrc
go version
```

### 2. Clone This Repository

```bash
cd ~
git clone https://github.com/yashwanta/mes-line-side-board.git mesapp
cd mesapp
```

### 3. Configure

```bash
cp .env.example .env
nano .env    # fill in DB_PASS and other values
```

### 4. Build the Go API Binary

```bash
go mod tidy
go build -o lsb-api main.go
```

### 5. Deploy API to /opt/lsb-api

```bash
mkdir -p /opt/lsb-api
cp lsb-api /opt/lsb-api/
cp .env     /opt/lsb-api/
chmod 600   /opt/lsb-api/.env
```

### 6. Start with PM2

```bash
cd /opt/lsb-api
pm2 start ./lsb-api --name lsb-api
pm2 save
pm2 startup systemd
# Copy and run the command it prints
```

### 7. Deploy Dashboard with nginx

```bash
apt install -y nginx
mkdir -p /var/www/lsb
cp index.html /var/www/lsb/

cat > /etc/nginx/sites-available/lsb << 'EOF'
server {
    listen 80;
    server_name _;
    root /var/www/lsb;
    index index.html;
    location / { try_files $uri /index.html; }
}
EOF

ln -sf /etc/nginx/sites-available/lsb /etc/nginx/sites-enabled/lsb
rm -f  /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx && systemctl enable nginx
```

### 8. Open Firewall

```bash
ufw allow 80/tcp
ufw allow 3001/tcp
ufw allow ssh
ufw enable
```

---

## ✅ Verify Everything Works

```bash
# API health check
curl http://localhost:3001/api/health

# Production data
curl "http://localhost:3001/api/production?resource=WM15&shift=2"

# PM2 status
pm2 status

# nginx status
systemctl status nginx
```

Open browser: **http://192.168.1.126**

---

## 🔧 Day-to-Day Management

| Task | Command |
|---|---|
| Check API is running | `pm2 status` |
| View live API logs | `pm2 logs lsb-api` |
| Restart API | `pm2 restart lsb-api` |
| Edit config | `nano /opt/lsb-api/.env` then `pm2 restart lsb-api` |
| Rebuild after code change | `go build -o lsb-api main.go && cp lsb-api /opt/lsb-api/ && pm2 restart lsb-api` |
| Check nginx | `systemctl status nginx` |
| Restart nginx | `systemctl restart nginx` |
| View PostgreSQL | `sudo -u postgres psql -d mesdb` |

---

## 🗃️ Insert Test Data

```sql
-- Connect to mesdb
sudo -u postgres psql -d mesdb

-- Production events (today, shift 2)
INSERT INTO production_log
  (event_ts, resource_id, part_number, operator_name, shift_number,
   good_count, scrap_count, cycle_time_seconds, notes)
VALUES
  (CURRENT_DATE + TIME '15:30:00', 'WM15', 'BMW1000D-360', 'Yashwanta Thakur', 2, 21, 1, 160.2, 'Tip change'),
  (CURRENT_DATE + TIME '16:20:00', 'WM15', 'BMW1000D-360', 'Yashwanta Thakur', 2, 24, 0, 151.4, 'Good run'),
  (CURRENT_DATE + TIME '17:15:00', 'WM15', 'BMW1000D-360', 'Yashwanta Thakur', 2, 19, 2, 168.7, 'Fixture issue');

-- Downtime event
INSERT INTO downtime_log (start_ts, end_ts, resource_id, reason_code, reason_detail, operator_name)
VALUES (NOW() - INTERVAL '20 minutes', NOW(), 'WM15', 'EQ', 'Spindle alarm reset', 'Yashwanta Thakur');

-- Open issue
INSERT INTO open_issues (status, severity, resource_id, issue_type, description)
VALUES ('open', 'high', 'WM15', 'Quality', 'CMM check required on batch A2247');
```

---

## 🔒 Security Notes

- `.env` is in `.gitignore` — **never** committed to Git
- DB user `mesapp` has only SELECT/INSERT/UPDATE/DELETE on MES tables
- API runs on port 3001 — restrict to plant subnet in production
- nginx serves dashboard on port 80
- Recommended: add TLS/HTTPS via Let's Encrypt or internal CA for production use

---

## 📞 Support

**Yashwanta Thakur**  
Plant IT / Cybersecurity  
MES-PostgreSQL · LXC 205 · Proxmox  
`192.168.1.126`

---

*Line Side Board v2.0 — Go API + PostgreSQL 17 + HTML5 Dashboard*
