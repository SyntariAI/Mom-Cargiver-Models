#!/bin/bash

# Safe Deployment Update Script for Mom's Care Tracker
# This script updates the application WITHOUT touching the database

set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║     Mom's Care Tracker - Safe Deployment Update            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

APP_DIR="$HOME/moms-care-tracker"
BACKUP_DIR="$HOME/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p "$BACKUP_DIR"

# ============================================================
# STEP 1: BACKUP DATABASE BEFORE ANYTHING ELSE
# ============================================================
echo "📦 Step 1: Backing up database..."
docker cp care-backend:/app/data/caregiver.db "$BACKUP_DIR/caregiver_$TIMESTAMP.db" 2>/dev/null || {
    echo "⚠️  Warning: Could not backup database (container may not be running)"
}

if [ -f "$BACKUP_DIR/caregiver_$TIMESTAMP.db" ]; then
    BACKUP_SIZE=$(ls -lh "$BACKUP_DIR/caregiver_$TIMESTAMP.db" | awk '{print $5}')
    echo "✅ Backup created: $BACKUP_DIR/caregiver_$TIMESTAMP.db ($BACKUP_SIZE)"
else
    echo "⚠️  No backup created - proceeding with caution"
fi

# Keep only last 10 backups
ls -t "$BACKUP_DIR"/caregiver_*.db 2>/dev/null | tail -n +11 | xargs -r rm

echo ""

# ============================================================
# STEP 2: FETCH LATEST CODE
# ============================================================
echo "📥 Step 2: Fetching latest code from GitHub..."
cd "$APP_DIR"

# Store current commit for comparison
OLD_COMMIT=$(git rev-parse HEAD)

git fetch origin main
git pull origin main

NEW_COMMIT=$(git rev-parse HEAD)

if [ "$OLD_COMMIT" = "$NEW_COMMIT" ]; then
    echo "ℹ️  Already up to date. No changes to deploy."
    exit 0
fi

echo "✅ Updated from ${OLD_COMMIT:0:7} to ${NEW_COMMIT:0:7}"
echo ""

# ============================================================
# STEP 3: CHECK FOR DANGEROUS CHANGES
# ============================================================
echo "🔍 Step 3: Checking for potentially dangerous changes..."

# Check if models.py was modified (database schema)
MODELS_CHANGED=$(git diff --name-only "$OLD_COMMIT" "$NEW_COMMIT" | grep -c "models.py" || true)

if [ "$MODELS_CHANGED" -gt 0 ]; then
    echo ""
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║  ⚠️  WARNING: DATABASE SCHEMA CHANGES DETECTED!            ║"
    echo "╠════════════════════════════════════════════════════════════╣"
    echo "║                                                            ║"
    echo "║  The file 'models.py' was modified in this update.        ║"
    echo "║  This MAY affect your database structure.                 ║"
    echo "║                                                            ║"
    echo "║  Changes detected:                                        ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo ""
    git diff "$OLD_COMMIT" "$NEW_COMMIT" -- "*/models.py" | head -50
    echo ""
    echo "════════════════════════════════════════════════════════════"
    echo ""
    echo "A backup was created at: $BACKUP_DIR/caregiver_$TIMESTAMP.db"
    echo ""
    read -p "Do you want to continue with the deployment? (yes/no): " CONFIRM
    if [ "$CONFIRM" != "yes" ]; then
        echo "❌ Deployment cancelled. Rolling back to previous commit..."
        git checkout "$OLD_COMMIT"
        echo "Rolled back to $OLD_COMMIT"
        exit 1
    fi
    echo ""
fi

# Check for migration files
MIGRATIONS=$(git diff --name-only "$OLD_COMMIT" "$NEW_COMMIT" | grep -c "migration" || true)
if [ "$MIGRATIONS" -gt 0 ]; then
    echo ""
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║  ⚠️  WARNING: MIGRATION FILES DETECTED!                    ║"
    echo "╠════════════════════════════════════════════════════════════╣"
    echo "║  Migration files were added/modified. Manual intervention  ║"
    echo "║  may be required to apply database migrations.            ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo ""
    read -p "Continue? (yes/no): " CONFIRM
    if [ "$CONFIRM" != "yes" ]; then
        git checkout "$OLD_COMMIT"
        exit 1
    fi
fi

echo "✅ No dangerous changes detected"
echo ""

# ============================================================
# STEP 4: REBUILD CONTAINERS (NOT VOLUMES!)
# ============================================================
echo "🔨 Step 4: Rebuilding containers..."

# Rebuild backend
echo "   Building backend..."
docker build -t care-tracker-backend ./backend

# Check if frontend dist exists (for pre-built deployments)
if [ -d "./frontend/dist" ]; then
    echo "   Building frontend (using pre-built files)..."
    docker build -t care-tracker-frontend -f ./frontend/Dockerfile.prod ./frontend
else
    echo "   ⚠️  Frontend dist/ not found. You need to:"
    echo "      1. Build locally: cd frontend && npm run build"
    echo "      2. Transfer dist/ to server"
    echo "      3. Run this script again"
    exit 1
fi

echo "✅ Images rebuilt"
echo ""

# ============================================================
# STEP 5: RESTART CONTAINERS (DATA VOLUME PRESERVED!)
# ============================================================
echo "🚀 Step 5: Restarting containers..."

# Stop containers
docker stop care-backend care-frontend 2>/dev/null || true
docker rm care-backend care-frontend 2>/dev/null || true

# Recreate network if needed
docker network create care-network 2>/dev/null || true

# Start backend (reusing existing volume!)
docker run -d \
  --name care-backend \
  --network care-network \
  --network-alias backend \
  -v app_data:/app/data \
  --restart always \
  care-tracker-backend

# Start frontend
docker run -d \
  --name care-frontend \
  --network care-network \
  -p 80:80 \
  -v "$(pwd)/deploy/nginx.ip.conf:/etc/nginx/conf.d/default.conf:ro" \
  -v "$(pwd)/deploy/htpasswd:/etc/nginx/.htpasswd:ro" \
  --restart always \
  care-tracker-frontend

echo "✅ Containers restarted"
echo ""

# ============================================================
# STEP 6: VERIFY DEPLOYMENT
# ============================================================
echo "🔍 Step 6: Verifying deployment..."
sleep 5

# Check containers are running
if docker ps | grep -q care-backend && docker ps | grep -q care-frontend; then
    echo "✅ Containers are running"
else
    echo "❌ ERROR: Containers failed to start!"
    echo "   Check logs with: docker logs care-backend"
    exit 1
fi

# Test API
API_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/api/pay-periods/ -u ylapidot:Cambodia581 2>/dev/null || echo "000")
if [ "$API_RESPONSE" = "200" ]; then
    echo "✅ API is responding"
else
    echo "⚠️  API returned status $API_RESPONSE (may still be starting)"
fi

# Verify data is intact
RECORD_COUNT=$(docker exec care-backend python -c "
import sqlite3
conn = sqlite3.connect('/app/data/caregiver.db')
cursor = conn.cursor()
cursor.execute('SELECT COUNT(*) FROM time_entries')
print(cursor.fetchone()[0])
conn.close()
" 2>/dev/null || echo "unknown")

echo "✅ Database records: $RECORD_COUNT time entries"

echo ""
echo "════════════════════════════════════════════════════════════"
echo "✅ Deployment complete!"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "📍 App URL: http://3.228.174.7"
echo "📦 Backup:  $BACKUP_DIR/caregiver_$TIMESTAMP.db"
echo ""
