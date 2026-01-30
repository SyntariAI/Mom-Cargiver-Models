# Deployment Guide - AWS Lightsail

## Quick Deploy (Automated)

### Prerequisites
- AWS CLI installed and configured (`brew install awscli && aws configure`)
- Domain name (optional, can use IP address)

### Step 1: Create Lightsail Instance
```bash
cd deploy
chmod +x setup-lightsail.sh
./setup-lightsail.sh
```

### Step 2: Deploy to Server
SSH into your instance and run:
```bash
curl -sSL https://raw.githubusercontent.com/YOUR_USERNAME/Mom-Cargiver-Models/main/deploy/install-on-server.sh | bash
```

---

## Manual Deployment

### 1. Create Lightsail Instance

1. Go to [AWS Lightsail Console](https://lightsail.aws.amazon.com/)
2. Click "Create instance"
3. Select:
   - Region: US East (N. Virginia) or closest to you
   - Platform: Linux/Unix
   - Blueprint: Amazon Linux 2023
   - Bundle: $3.50/month (512 MB RAM)
4. Name it: `moms-care-tracker`
5. Click "Create instance"

### 2. Configure Networking

1. Go to instance → Networking
2. Add firewall rules:
   - HTTP (80)
   - HTTPS (443)
3. Create and attach a static IP

### 3. Connect to Instance

```bash
# Using AWS CLI
aws lightsail ssh --instance-name moms-care-tracker

# Or download SSH key from Lightsail console and use:
ssh -i your-key.pem ec2-user@YOUR_IP
```

### 4. Install Docker on Server

```bash
sudo yum update -y
sudo yum install -y docker git
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker ec2-user

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Log out and back in for docker group to take effect
exit
```

### 5. Clone and Deploy

```bash
# Clone repository
git clone https://github.com/YOUR_USERNAME/Mom-Cargiver-Models.git
cd Mom-Cargiver-Models/deploy

# Create password file (replace USERNAME and PASSWORD)
htpasswd -bc htpasswd USERNAME PASSWORD

# Update nginx config with your domain
sed -i 's/DOMAIN_PLACEHOLDER/your-domain.com/g' nginx.prod.conf

# Deploy
docker-compose -f docker-compose.prod.yml up -d --build
```

### 6. Set Up SSL (HTTPS)

```bash
# Get SSL certificate
docker run --rm -v certbot_conf:/etc/letsencrypt -v certbot_www:/var/www/certbot \
  certbot/certbot certonly --webroot --webroot-path=/var/www/certbot \
  --email your@email.com --agree-tos --no-eff-email -d your-domain.com

# Restart to apply SSL
docker-compose -f docker-compose.prod.yml restart frontend
```

---

## Safe Updates (IMPORTANT!)

### How Data is Protected

Your database lives in a **Docker volume** (`app_data`), separate from the code containers:

```
Docker Volume (app_data)     ← YOUR DATA (persistent, survives updates)
    └── caregiver.db

Docker Containers            ← CODE (rebuilt on updates)
    ├── care-backend
    └── care-frontend
```

**Safe operations (won't lose data):**
- `docker stop/start` containers
- `docker rm` containers
- Rebuilding images
- Running `update.sh`

**DANGEROUS operations (WILL lose data):**
- `docker volume rm app_data` ← NEVER DO THIS
- `docker system prune --volumes` ← DANGEROUS

---

### Recommended: Use the Safe Update Script

```bash
# SSH into your server
ssh -i your-key.pem ec2-user@3.228.174.7

# Run safe update (auto-backup + schema change detection)
cd ~/moms-care-tracker/deploy
chmod +x update.sh
./update.sh
```

The update script will:
1. ✅ **Backup database** before any changes
2. ✅ **Detect schema changes** in models.py and warn you
3. ✅ **Detect migrations** and require confirmation
4. ✅ **Rebuild containers** without touching data volume
5. ✅ **Verify data** is intact after deployment

---

### If Something Goes Wrong: Restore from Backup

```bash
# List available backups
ls -la ~/backups/

# Restore a specific backup
cd ~/moms-care-tracker/deploy
chmod +x restore-backup.sh
./restore-backup.sh caregiver_20260130_150000.db
```

---

## Maintenance

### View Logs
```bash
docker logs care-backend --tail 100 -f
docker logs care-frontend --tail 100 -f
```

### Restart Services
```bash
docker restart care-backend care-frontend
```

### Manual Backup
```bash
docker cp care-backend:/app/data/caregiver.db ~/backups/manual-backup-$(date +%Y%m%d).db
```

### Change Login Password
```bash
cd ~/moms-care-tracker/deploy
htpasswd htpasswd USERNAME   # Enter new password when prompted
docker restart care-frontend
```

---

## Costs

- Lightsail instance: $3.50/month
- Static IP: Free (when attached)
- Data transfer: 1TB included
- **Total: ~$3.50/month**
