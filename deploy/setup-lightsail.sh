#!/bin/bash

# AWS Lightsail Deployment Script for Mom's Care Tracker
# This script helps you deploy the app to AWS Lightsail

set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║     Mom's Care Tracker - AWS Lightsail Deployment          ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI is not installed. Please install it first:"
    echo "   brew install awscli"
    echo "   Then run: aws configure"
    exit 1
fi

# Configuration
INSTANCE_NAME="moms-care-tracker"
REGION="us-east-1"
BLUEPRINT="amazon_linux_2023"
BUNDLE="nano_3_0"  # $3.50/month - 512MB RAM, 2 vCPU burst

echo "📋 Configuration:"
echo "   Instance Name: $INSTANCE_NAME"
echo "   Region: $REGION"
echo "   Blueprint: $BLUEPRINT"
echo "   Bundle: $BUNDLE (512MB RAM, $3.50/month)"
echo ""

read -p "Continue with this configuration? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
fi

echo ""
echo "🚀 Step 1: Creating Lightsail instance..."

# Create instance with Docker pre-installed
aws lightsail create-instances \
    --instance-names $INSTANCE_NAME \
    --availability-zone ${REGION}a \
    --blueprint-id $BLUEPRINT \
    --bundle-id $BUNDLE \
    --user-data '#!/bin/bash
# Install Docker
yum update -y
yum install -y docker git
systemctl start docker
systemctl enable docker
usermod -aG docker ec2-user

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose
' \
    --region $REGION

echo "⏳ Waiting for instance to be running..."
aws lightsail wait instance-running --instance-name $INSTANCE_NAME --region $REGION

echo ""
echo "🔓 Step 2: Opening firewall ports..."

# Open HTTP port
aws lightsail open-instance-public-ports \
    --instance-name $INSTANCE_NAME \
    --port-info fromPort=80,toPort=80,protocol=tcp \
    --region $REGION

# Open HTTPS port
aws lightsail open-instance-public-ports \
    --instance-name $INSTANCE_NAME \
    --port-info fromPort=443,toPort=443,protocol=tcp \
    --region $REGION

echo ""
echo "🌐 Step 3: Allocating static IP..."

aws lightsail allocate-static-ip \
    --static-ip-name ${INSTANCE_NAME}-ip \
    --region $REGION 2>/dev/null || echo "   (Static IP may already exist)"

aws lightsail attach-static-ip \
    --static-ip-name ${INSTANCE_NAME}-ip \
    --instance-name $INSTANCE_NAME \
    --region $REGION

# Get the IP address
STATIC_IP=$(aws lightsail get-static-ip --static-ip-name ${INSTANCE_NAME}-ip --region $REGION --query 'staticIp.ipAddress' --output text)

echo ""
echo "════════════════════════════════════════════════════════════"
echo "✅ Instance created successfully!"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "📍 Your static IP address: $STATIC_IP"
echo ""
echo "⏳ Please wait 2-3 minutes for the instance to fully initialize."
echo ""
echo "📋 Next steps:"
echo ""
echo "1. Point your domain to this IP: $STATIC_IP"
echo "   (Or use the IP directly for testing)"
echo ""
echo "2. SSH into your instance:"
echo "   aws lightsail ssh --instance-name $INSTANCE_NAME --region $REGION"
echo ""
echo "3. Run the deploy script on the server:"
echo "   curl -sSL https://raw.githubusercontent.com/YOUR_REPO/main/deploy/install-on-server.sh | bash"
echo ""
echo "   Or manually clone and deploy (see deploy/DEPLOY.md for instructions)"
echo ""
