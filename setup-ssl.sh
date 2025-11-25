#!/bin/bash
# SSL Setup Script for Vibez.now Backend
# Run this AFTER DNS has propagated

set -e

PEM_FILE="/Users/williamschulz/Downloads/Vibez.now.pem"
EC2_HOST="ec2-user@ec2-13-56-236-209.us-west-1.compute.amazonaws.com"
DOMAIN="dev.vibez.now"
EMAIL="will.schulz@aw3.tech"

echo "Checking DNS propagation for $DOMAIN..."
IP=$(dig +short @8.8.8.8 $DOMAIN | head -1)

if [ -z "$IP" ]; then
    echo "ERROR: DNS for $DOMAIN is not resolving yet."
    echo "Please wait for DNS propagation and try again."
    exit 1
fi

if [ "$IP" != "13.56.236.209" ]; then
    echo "WARNING: $DOMAIN resolves to $IP but should be 13.56.236.209"
    echo "Please check your DNS configuration."
    exit 1
fi

echo "DNS is correctly configured! ($DOMAIN -> $IP)"
echo "Setting up SSL certificate with Let's Encrypt..."

ssh -i "$PEM_FILE" "$EC2_HOST" "sudo certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email $EMAIL --redirect"

echo ""
echo "SSL setup complete!"
echo "Your site should now be accessible at: https://$DOMAIN"
echo ""
echo "Testing HTTPS..."
sleep 2
curl -I "https://$DOMAIN/health"
