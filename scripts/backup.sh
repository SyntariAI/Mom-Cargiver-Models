#!/bin/bash
# Backup the database
DATE=$(date +%Y%m%d_%H%M%S)
cp ./data/caregiver.db ./backups/caregiver_$DATE.db
echo "Backup created: backups/caregiver_$DATE.db"
