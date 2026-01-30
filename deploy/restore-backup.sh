#!/bin/bash

# Database Restore Script for Mom's Care Tracker
# Use this to restore from a backup if something goes wrong

set -e

BACKUP_DIR="$HOME/backups"

echo "╔════════════════════════════════════════════════════════════╗"
echo "║     Mom's Care Tracker - Database Restore                  ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# List available backups
echo "Available backups:"
echo ""
ls -lh "$BACKUP_DIR"/caregiver_*.db 2>/dev/null | while read line; do
    echo "  $line"
done

echo ""

if [ -z "$1" ]; then
    echo "Usage: ./restore-backup.sh <backup-filename>"
    echo ""
    echo "Example: ./restore-backup.sh caregiver_20260130_150000.db"
    exit 1
fi

BACKUP_FILE="$BACKUP_DIR/$1"

if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ Backup file not found: $BACKUP_FILE"
    exit 1
fi

echo "⚠️  WARNING: This will REPLACE the current database with:"
echo "    $BACKUP_FILE"
echo ""
read -p "Are you sure? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "❌ Restore cancelled"
    exit 1
fi

echo ""
echo "📦 Restoring database..."

# Stop backend
docker stop care-backend

# Copy backup to container volume
docker run --rm -v app_data:/data -v "$BACKUP_DIR:/backup" alpine \
    cp "/backup/$1" /data/caregiver.db

# Start backend
docker start care-backend

echo ""
echo "✅ Database restored from: $1"
echo ""

# Verify
sleep 3
RECORD_COUNT=$(docker exec care-backend python -c "
import sqlite3
conn = sqlite3.connect('/app/data/caregiver.db')
cursor = conn.cursor()
cursor.execute('SELECT COUNT(*) FROM time_entries')
print(cursor.fetchone()[0])
conn.close()
" 2>/dev/null || echo "unknown")

echo "📊 Verified: $RECORD_COUNT time entries in restored database"
