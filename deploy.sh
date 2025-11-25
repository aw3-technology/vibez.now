#!/bin/bash
# Deployment script for Vibez.now backend

set -e

echo "Deploying Vibez.now backend to EC2..."

# SSH connection details
PEM_FILE="/Users/williamschulz/Downloads/Vibez.now.pem"
EC2_HOST="ec2-user@ec2-13-56-236-209.us-west-1.compute.amazonaws.com"
APP_DIR="~/vibez-now-backend"

# Pull latest code
echo "Pulling latest code from GitHub..."
ssh -i "$PEM_FILE" "$EC2_HOST" "cd $APP_DIR && git pull origin master"

# Install dependencies
echo "Installing dependencies..."
ssh -i "$PEM_FILE" "$EC2_HOST" "cd $APP_DIR && source ~/.nvm/nvm.sh && npm install"

# Restart application
echo "Restarting application with PM2..."
ssh -i "$PEM_FILE" "$EC2_HOST" "source ~/.nvm/nvm.sh && pm2 restart vibez-now-backend"

# Show status
echo "Application status:"
ssh -i "$PEM_FILE" "$EC2_HOST" "source ~/.nvm/nvm.sh && pm2 status"

echo "Deployment complete!"
