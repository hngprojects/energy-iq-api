# Infrastructure & DevOps Documentation

> **Audience:** New DevOps engineers onboarding to the project
> **Last Updated:** May 2026
> **Application:** Energy IQ
---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Server Access](#2-server-access)
3. [Directory Structure](#3-directory-structure)
4. [Application Runtime](#4-application-runtime)
5. [Release & Deployment Model](#5-release--deployment-model)
6. [Database — PostgreSQL & Migrations](#6-database--postgresql--migrations)
7. [Reverse Proxy — Nginx](#7-reverse-proxy--nginx)
8. [SSL/TLS — Let's Encrypt](#8-ssltls--lets-encrypt)
9. [Environment Variables](#9-environment-variables)
10. [CI/CD Pipeline](#10-cicd-pipeline)
11. [Deployment Flow](#11-deployment-flow)
12. [Rollback](#12-rollback)
13. [Common Operations](#13-common-operations)
14. [Known Gaps & Recommendations](#14-known-gaps--recommendations)

---

## 1. Architecture Overview

```
                        Internet
                           │
                      [ Nginx ]
                     (Port 80/443)
                    /             \
         [Staging Backend]    [Prod Backend]
          Node.js / PM2        Node.js / PM2
            Port 3330            Port 3331
                    \             /
                  [ PostgreSQL ]
                   (Port 5432)

      All services run on a single bare metal server
                    Ubuntu 24.04 LTS
```

Both staging and production environments share the **same physical server**. They are isolated by:
- Separate directory trees under `/home/<user>/backend/`
- Separate PM2 process names (`be-staging`, `be-prod`)
- Separate Nginx server blocks and ports
- Separate databases in PostgreSQL
- Separate `.env` files

---

## 2. Server Access

Access is via SSH using a private key. You will need the following from a current team member:

- Server IP address
- SSH username
- Your SSH private key added to the server's `~/.ssh/authorized_keys`

```bash
ssh <SSH_USER>@<SERVER_IP>
```

> Never share SSH keys. If you need access, generate your own key pair and send the **public key** to the team lead to be added to the server.

---

## 3. Directory Structure

The deployment uses a **releases + symlink** model. Each deploy unpacks into a folder, and `current` is a symlink pointing to the active release. This makes rollbacks instant.

```
/home/<SSH_USER>/
└── backend/
    ├── staging/
    │   ├── releases/
    │   │   ├── abc123def456.tar.gz/   # older release
    │   │   └── def456abc789.tar.gz/   # current release (latest)
    │   ├── shared/
    │   │   └── .env                   # staging env vars (symlinked into each release)
    │   ├── current -> releases/def456abc789.tar.gz/   # symlink to active release
    │   └── .prev_release              # path of the previous release (used for rollback)
    └── prod/
        ├── releases/
        │   ├── abc123def456.tar.gz/
        │   └── def456abc789.tar.gz/
        ├── shared/
        │   └── .env                   # prod env vars (symlinked into each release)
        ├── current -> releases/def456abc789.tar.gz/
        └── .prev_release
```

**Key points:**
- The pipeline keeps only the **last 3 releases**. Older ones are deleted automatically.
- `shared/.env` is symlinked into each release at deploy time — you never edit `.env` inside a release folder directly.
- Nginx proxies to the app running from `current/`.

---

## 4. Application Runtime

The backend is a **Node.js / NestJS** application compiled to `dist/main.js`, managed by **PM2**.

### PM2 Process Names

| Environment | PM2 Name     | Port | Entry Point       |
|-------------|--------------|------|-------------------|
| Staging     | `be-staging` | 3005 | `dist/main.js`    |
| Production  | `be-prod`    | 3000 | `dist/main.js`    |

### Useful PM2 Commands

```bash
# View all running processes and their status
pm2 list

# View live logs
pm2 logs be-staging
pm2 logs be-prod

# View last N lines of logs
pm2 logs be-prod --lines 100

# Reload with zero downtime — preferred, picks up new .env values
pm2 reload be-staging --update-env
pm2 reload be-prod --update-env

# Hard restart (causes brief downtime)
pm2 restart be-staging

# Real-time CPU and memory monitor
pm2 monit

# Save process list so PM2 restores on server reboot
pm2 save

# Restore saved processes after a reboot
pm2 resurrect
```

---

## 5. Release & Deployment Model

The pipeline does **not** do a `git pull` on the server. Instead it:

1. Checks out the code and builds it on the GitHub Actions runner
2. Archives the built output into a `.tar.gz` named after the first 12 characters of the commit SHA (e.g. `abc123def456.tar.gz`)
3. SCPs the archive to `/tmp` on the server
4. SSHs in and extracts it into `releases/`
5. Symlinks `shared/.env` into the new release
6. Runs database migrations from the new release
7. Atomically swaps the `current` symlink to point to the new release
8. Reloads PM2
9. Cleans up `/tmp` and old releases (keeps last 3)

This means **deployments are atomic** — traffic is only cut over after the build, install, and migrations are all done.

---

## 6. Database — PostgreSQL & Migrations

PostgreSQL runs on the **same server** as the application on `localhost:5432`. It is not exposed to the internet.

### Connecting to PostgreSQL

```bash
# Connect as the postgres superuser
sudo -u postgres psql

# Connect to a specific database directly
sudo -u postgres psql -d <database_name>
```

### Useful psql Commands

```sql
-- List all databases
\l

-- List all users/roles
\du

-- Connect to a different database
\c <database_name>

-- List tables in current database
\dt

-- Quit
\q
```

### Creating a New Database & User

```sql
CREATE DATABASE myapp_staging;
CREATE USER myapp_user WITH PASSWORD 'strongpassword';
GRANT ALL PRIVILEGES ON DATABASE myapp_staging TO myapp_user;
```

### PostgreSQL Service Commands

```bash
sudo systemctl status postgresql
sudo systemctl restart postgresql
sudo systemctl stop postgresql
```

### Database Migrations

Migrations are run automatically during every deployment **before** the `current` symlink is swapped. The pipeline runs:

```bash
pnpm migration:run    # on deploy
pnpm migration:revert # on rollback
```

> **Never run migrations manually on production unless explicitly instructed.** A failed migration mid-deploy triggers the automatic rollback which also reverts the migration.

If you need to check migration status manually:

```bash
cd /home/<SSH_USER>/backend/prod/current
pnpm migration:run --dry-run   # check what would run (if supported)
```

---

## 7. Reverse Proxy — Nginx

Nginx handles all incoming traffic on ports 80 and 443, terminating SSL and forwarding to the correct backend process.

### Config File Locations

```bash
/etc/nginx/sites-available/staging    # Staging server block
/etc/nginx/sites-available/prod       # Production server block
/etc/nginx/sites-enabled/             # Symlinks to active configs
```

### Typical Server Block Structure

```nginx
server {
    listen 443 ssl;
    server_name staging.energy-iq.hng14.com;

    ssl_certificate /etc/letsencrypt/live/staging.energy-iq.hng14.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/staging.energy-iq.hng14.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3330;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Common Nginx Commands

```bash
# Always test config before reloading
sudo nginx -t

# Reload with no downtime
sudo systemctl reload nginx

# Full restart (brief downtime)
sudo systemctl restart nginx

# Check status
sudo systemctl status nginx

# View error logs
sudo tail -f /var/log/nginx/error.log

# View access logs
sudo tail -f /var/log/nginx/access.log
```

> Always run `sudo nginx -t` before reloading. A syntax error in the config will take down **both** staging and production.

---

## 8. SSL/TLS — Let's Encrypt

SSL certificates are issued and auto-renewed by **Certbot**.

### Certificate Locations

```bash
/etc/letsencrypt/live/<domain>/fullchain.pem   # Certificate chain
/etc/letsencrypt/live/<domain>/privkey.pem     # Private key
```

### Managing Certificates

```bash
# Check auto-renewal timer
sudo systemctl status certbot.timer

# Test renewal without actually renewing
sudo certbot renew --dry-run

# Force renew manually
sudo certbot renew

# Add a certificate for a new domain
sudo certbot --nginx -d <your-domain.com>
```

> Certificates expire every 90 days. Certbot auto-renews them. Run `--dry-run` periodically to confirm the renewal process is healthy.

---

## 9. Environment Variables

Environment variables live in `shared/.env` for each environment. They are **never** committed to the repository and are **never** stored inside a release folder directly — each release gets a symlink to the shared file.

### Locations

```bash
/home/<SSH_USER>/backend/staging/shared/.env   # Staging
/home/<SSH_USER>/backend/prod/shared/.env      # Production
```

### Editing Environment Variables

```bash
# Edit staging env
nano /home/<SSH_USER>/backend/staging/shared/.env

# Reload staging app to pick up the new values
pm2 reload be-staging --update-env

# Edit production env
nano /home/<SSH_USER>/backend/prod/shared/.env

# Reload production app
pm2 reload be-prod --update-env
```

> Always reload PM2 with `--update-env` after any `.env` change. Without it, the running process keeps the old values in memory.

### GitHub Actions Secrets

Sensitive values used by the pipeline are stored as GitHub Actions secrets.

**GitHub repo → Settings → Secrets and variables → Actions**

| Secret Name          | Used In        | Description                      |
|----------------------|----------------|----------------------------------|
| `SERVER_IP`          | deploy-staging | Bare metal server IP             |
| `SSH_USER`           | Both           | SSH username                     |
| `SSH_KEY`            | Both           | SSH private key                  |
| `STAGING_HEALTH_URL` | deploy-staging | Staging health check endpoint    |
| `PROD_SERVER_IP`     | deploy-prod    | Production server IP             |
| `PROD_HEALTH_URL`    | deploy-prod    | Production health check endpoint |

---

## 10. CI/CD Pipeline

All workflow files live in `.github/workflows/`.

### Workflow Files

| File                 | Purpose                                                                 |
|----------------------|-------------------------------------------------------------------------|
| `ci.yaml`            | Full quality gate — lint, unit tests, build, E2E tests, security scans |
| `deploy-staging.yml` | Deploys to staging when CI passes on a push to `staging`               |
| `deploy-prod.yml`    | Deploys to production when CI passes on a push to `main`               |

### CI Jobs (ci.yaml)

The CI workflow runs these jobs on every PR and on every push to `dev`, `staging`, and `main`:

| Job                     | What it does                                                                 | Timeout |
|-------------------------|------------------------------------------------------------------------------|---------|
| `lint`                  | Runs ESLint. Fails if lint auto-fixed anything (forces clean local commits)  | 5 min   |
| `unit-tests`            | Runs unit tests with coverage. Uploads coverage artifact on failure          | 5 min   |
| `build`                 | Compiles the app. Uploads `dist/` as a build artifact                        | 10 min  |
| `e2e-tests`             | Runs E2E tests against the built artifact. Needs lint, unit tests, and build to pass first | 10 min |
| `forbidden-pattern-scan`| Scans codebase for forbidden patterns via a shell script                     | —       |
| `lazarus-scanner`       | Runs the Lazarus security scanner (pinned commit SHA)                        | —       |
| `security-scan`         | Trivy filesystem scan for CRITICAL/HIGH CVEs. Uploads SARIF to GitHub Security tab on failure | 10 min |

### Required Status Checks (Branch Protection)

Only these two checks are **required** to pass before a PR can be merged:

- `Forbidden Pattern Scan`
- `Lazarus Scanner`

All other jobs (lint, tests, build, Trivy) run on every PR but are **not** blocking merge gates — they are informational and visible in the PR checks UI.

### Branch Strategy

| Branch    | Purpose                    | Deploys To  |
|-----------|----------------------------|-------------|
| `dev`     | Active development         | —           |
| `staging` | Pre-production testing     | Staging     |
| `main`    | Production-ready code      | Production  |

---

## 11. Deployment Flow

### How a Change Gets to Staging

```
1.  Developer opens a PR: feature-branch → staging
2.  CI runs all jobs (lint, unit tests, build, E2E, security scans)
3.  Required checks pass (forbidden pattern + lazarus)
4.  PR is reviewed, approved, and merged
5.  Merge commit lands on the staging branch (a push event)
6.  CI runs again on the staging branch
7.  CI passes → deploy-staging.yml fires via workflow_run
8.  Runner builds the app and creates a .tar.gz archive
9.  Archive is SCP'd to /tmp on the server
10. SSH: extract → install deps → symlink .env → run migrations → swap symlink → reload PM2
11. Health check polls the staging URL (up to 5 attempts) checking HTTP 200 and {"data":{"status":"ok"}}
12. If health check fails → automatic rollback kicks in
```

### How a Change Gets to Production

Identical flow but targeting `main`, using `PROD_SERVER_IP`, `PROD_SSH_KEY`, and `PROD_HEALTH_URL`. The PM2 process is `be-prod` on port 3000.

### Manual Deployment (Emergency)

Use `workflow_dispatch` from the GitHub Actions UI on either deploy workflow to trigger a manual deploy without a new commit.

If you need to deploy entirely by hand on the server:

```bash
ssh <SSH_USER>@<SERVER_IP>

# Navigate to the current release
cd /home/<SSH_USER>/backend/staging/current

# Pull in new code if needed (not typical in this model — prefer re-running the pipeline)
# Install, build, migrate, reload
pnpm install --frozen-lockfile
pnpm build
pnpm migration:run
pm2 reload be-staging --update-env
```

---

## 12. Rollback

Rollback is **automatic** if the health check fails after a deploy. It can also be triggered manually.

### How Automatic Rollback Works

1. Before swapping the `current` symlink, the pipeline saves the previous release path to `.prev_release`
2. If the health check fails, a rollback job runs:
   - Reads `.prev_release` to find the last good release
   - Points `current` back to it
   - Runs `pnpm migration:revert` to undo the migration
   - Reloads PM2 from the previous release

### Manual Rollback

```bash
ssh <SSH_USER>@<SERVER_IP>

APP_DIR=/home/<SSH_USER>/backend/staging

# See what the previous release was
cat "$APP_DIR/.prev_release"

# Point current to the previous release
ln -sfn "$(cat $APP_DIR/.prev_release)" "$APP_DIR/current"

# Revert the migration
cd "$APP_DIR/current"
pnpm migration:revert

# Reload the app
pm2 reload be-staging --update-env
```

> Repeat the same steps with `prod` paths and `be-prod` for production rollback.

---

## 13. Common Operations

### App is down — quick diagnosis

```bash
# 1. Check PM2 process status
pm2 list

# 2. Check recent app logs
pm2 logs be-prod --lines 50

# 3. Check what release is currently active
ls -la /home/<SSH_USER>/backend/prod/current

# 4. Check if Nginx is running
sudo systemctl status nginx

# 5. Check if the port is listening
ss -tlnp | grep 3000   # prod
ss -tlnp | grep 3005   # staging

# 6. Check Nginx error log
sudo tail -f /var/log/nginx/error.log
```

### Restarting everything after a server reboot

```bash
# Restore PM2 processes from saved list
pm2 resurrect

# If that doesn't work, start manually
cd /home/<SSH_USER>/backend/staging/current
pm2 start dist/main.js --name be-staging

cd /home/<SSH_USER>/backend/prod/current
pm2 start dist/main.js --name be-prod

pm2 save

# Ensure Nginx and PostgreSQL are running
sudo systemctl start nginx
sudo systemctl start postgresql
```

### Checking disk usage

Old releases are cleaned up automatically (last 3 kept), but check periodically:

```bash
df -h

# See how much space releases are using
du -sh /home/<SSH_USER>/backend/staging/releases/*
du -sh /home/<SSH_USER>/backend/prod/releases/*

# Manually remove a specific old release if needed
rm -rf /home/<SSH_USER>/backend/staging/releases/<old-release-folder>
```

### Checking memory and CPU

```bash
free -h
pm2 monit   # real-time per-process CPU and memory
```

---

## 14. Known Gaps & Recommendations

These are known areas to address as the project matures. Documented here so nothing is hidden from new joiners.

| Gap | Risk | Recommendation |
|-----|------|----------------|
| No database backups | Data loss on server failure | Set up daily `pg_dump` to off-server storage (S3, Backblaze) |
| No monitoring or alerting | Outages go unnoticed | Add UptimeRobot for uptime alerts; PM2+ or Grafana for metrics |
| Staging and prod share one server | A server crash takes down both | Separate servers when budget allows |
| `.env` managed manually on server | Easy to lose or misconfigure | Migrate to a secrets manager (Doppler, AWS Secrets Manager) |
| Server was set up manually | Not reproducible after a failure | Write an Ansible playbook to codify the setup |
| No SSL monitoring | Certificate expiry causes outage | Add cert expiry alert or run `certbot renew --dry-run` in a cron |
| No log aggregation | Hard to debug production issues | Consider Loki + Grafana or a hosted log service |
| Migration revert is a single step | Complex migrations may not revert cleanly | Ensure all migrations have a working `down` method; test locally |