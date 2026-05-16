#!/usr/bin/env bash
set -euo pipefail

# ---- Interactive config ----
read -r -p "Database name [energy_iq_db]: " DB_NAME
DB_NAME=${DB_NAME:-energy_iq_db}

read -r -p "Database user [energy_iq]: " DB_USER
DB_USER=${DB_USER:-energy_iq}

read -r -s -p "Database password (input hidden): " DB_PASSWORD
echo

read -r -p "Allow remote connections? [no]: " ALLOW_REMOTE
ALLOW_REMOTE=${ALLOW_REMOTE:-no}

# ---- Resolve Postgres config paths (Ubuntu/Debian) ----
PG_VERSION="$(find /etc/postgresql -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort -V | tail -n 1)"
PG_CONF_DIR="/etc/postgresql/${PG_VERSION}/main"
PG_CONF="${PG_CONF_DIR}/postgresql.conf"
PG_HBA="${PG_CONF_DIR}/pg_hba.conf"

echo "Using Postgres ${PG_VERSION} config in ${PG_CONF_DIR}"

# ---- Create role and database ----
# Use top-level SELECT with \gexec so psql variable substitution works
sudo -u postgres psql -v ON_ERROR_STOP=1 \
  -v db_user="${DB_USER}" -v db_name="${DB_NAME}" -v db_password="${DB_PASSWORD}" <<'SQL'
SELECT 'CREATE ROLE ' || quote_ident(:'db_user') || ' LOGIN PASSWORD ' || quote_literal(:'db_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'db_user')\gexec

SELECT 'CREATE DATABASE ' || quote_ident(:'db_name') || ' OWNER ' || quote_ident(:'db_user')
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = :'db_name')\gexec
SQL

# ---- Extensions ----
sudo -u postgres psql -d "${DB_NAME}" <<SQL
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "citext";
SQL

# ---- Schema grants ----
sudo -u postgres psql -d "${DB_NAME}" <<SQL
GRANT USAGE, CREATE ON SCHEMA public TO ${DB_USER};
SQL

# ---- Local-only network config ----
if [[ "${ALLOW_REMOTE}" == "no" ]]; then
  sudo sed -i "s/^#*listen_addresses.*/listen_addresses = 'localhost'/" "${PG_CONF}"

  # Ensure local connections are allowed
  if ! grep -qE '^\s*host\s+all\s+all\s+127\.0\.0\.1/32' "${PG_HBA}"; then
    echo "host all all 127.0.0.1/32 scram-sha-256" | sudo tee -a "${PG_HBA}" >/dev/null
  fi
  if ! grep -qE '^\s*host\s+all\s+all\s+::1/128' "${PG_HBA}"; then
    echo "host all all ::1/128 scram-sha-256" | sudo tee -a "${PG_HBA}" >/dev/null
  fi
fi

# ---- Reload Postgres ----
sudo systemctl reload postgresql

echo "Done. DB=${DB_NAME}, USER=${DB_USER}, EXTENSIONS=uuid-ossp,citext, REMOTE=${ALLOW_REMOTE}"