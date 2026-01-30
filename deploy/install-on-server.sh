#!/bin/bash

# Server-side installation script for Mom's Care Tracker
# Run this on your AWS Lightsail instance

set -e

APP_DIR="/home/ec2-user/moms-care-tracker"

echo "╔════════════════════════════════════════════════════════════╗"
echo "║     Mom's Care Tracker - Server Installation               ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Get configuration from user
read -p "Enter your domain name (e.g., care.example.com): " DOMAIN
read -p "Enter your email (for SSL certificate): " EMAIL
read -p "Enter username for app login: " APP_USER
read -sp "Enter password for app login: " APP_PASS
echo ""

echo ""
echo "📋 Configuration:"
echo "   Domain: $DOMAIN"
echo "   Email: $EMAIL"
echo "   Username: $APP_USER"
echo ""

# Clone repository
echo "📥 Cloning repository..."
if [ -d "$APP_DIR" ]; then
    cd $APP_DIR
    git pull
else
    git clone https://github.com/YOUR_USERNAME/Mom-Cargiver-Models.git $APP_DIR
    cd $APP_DIR
fi

# Create deploy directory
cd $APP_DIR/deploy

# Generate htpasswd file
echo "🔐 Generating password file..."
htpasswd -bc htpasswd "$APP_USER" "$APP_PASS"

# Update nginx config with domain
echo "📝 Configuring nginx for $DOMAIN..."
sed -i "s/DOMAIN_PLACEHOLDER/$DOMAIN/g" nginx.prod.conf

# Create initial nginx config for SSL certificate generation
cat > nginx.initial.conf << 'INITNGINX'
server {
    listen 80;
    server_name _;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 200 'Setting up SSL...';
        add_header Content-Type text/plain;
    }
}
INITNGINX

# Start with initial config to get SSL cert
echo "🔒 Setting up SSL certificate..."
docker-compose -f docker-compose.prod.yml down 2>/dev/null || true

# Build and start just nginx for cert generation
docker build -t frontend-temp -f ../frontend/Dockerfile.prod ../frontend
docker run -d --name nginx-temp -p 80:80 -v $(pwd)/nginx.initial.conf:/etc/nginx/conf.d/default.conf:ro -v certbot_www:/var/www/certbot frontend-temp

# Wait for nginx to start
sleep 5

# Get SSL certificate
docker run --rm -v certbot_conf:/etc/letsencrypt -v certbot_www:/var/www/certbot certbot/certbot certonly --webroot --webroot-path=/var/www/certbot --email $EMAIL --agree-tos --no-eff-email -d $DOMAIN

# Stop temporary nginx
docker stop nginx-temp && docker rm nginx-temp

# Start full application
echo "🚀 Starting application..."
docker-compose -f docker-compose.prod.yml up -d --build

echo ""
echo "════════════════════════════════════════════════════════════"
echo "✅ Deployment complete!"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "🌐 Your app is now running at: https://$DOMAIN"
echo ""
echo "🔐 Login credentials:"
echo "   Username: $APP_USER"
echo "   Password: (the password you entered)"
echo ""
echo "📋 Useful commands:"
echo "   View logs:     docker-compose -f docker-compose.prod.yml logs -f"
echo "   Restart:       docker-compose -f docker-compose.prod.yml restart"
echo "   Stop:          docker-compose -f docker-compose.prod.yml down"
echo ""
