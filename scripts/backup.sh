#!/bin/bash
# HIVE PostgreSQL Backup Script
# Usage: ./scripts/backup.sh
# Can be executed via cron: 0 2 * * * /path/to/hive/scripts/backup.sh

# Exit on error
set -e

# Load environment variables (contains DATABASE_URL)
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | awk '/=/ {print $1}')
fi

if [ -z "$DATABASE_URL" ]; then
  echo "Error: DATABASE_URL is not set in .env"
  exit 1
fi

BACKUP_DIR="./backups"
DATE=$(date +%Y-%m-%d_%H-%M-%S)
BACKUP_FILE="$BACKUP_DIR/hive_db_backup_$DATE.sql"

mkdir -p "$BACKUP_DIR"

echo "Starting PostgreSQL backup to $BACKUP_FILE"
pg_dump "$DATABASE_URL" -F p -f "$BACKUP_FILE"
echo "Backup complete!"

# Optional: keep only last 7 days of backups
# find "$BACKUP_DIR" -type f -name "*.sql" -mtime +7 -delete
