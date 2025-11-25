# Deployment Guide for Vibez.now Backend

## Server Information
- **Instance ID**: i-0d645481258563b74
- **Public DNS**: ec2-13-56-236-209.us-west-1.compute.amazonaws.com
- **Public IP**: 13.56.236.209
- **Domain**: dev.vibez.now
- **OS**: Amazon Linux 2023
- **Node.js**: v20.19.6
- **Process Manager**: PM2 v6.0.13

## Current Setup

The backend is deployed and running with:
- Express.js server on port 3000
- Nginx reverse proxy on port 80
- PM2 process manager with auto-restart on reboot
- HTTPS ready (needs SSL certificate after DNS setup)

## DNS Configuration (COMPLETED ✅)

DNS has been configured with the following A record:
```
Type: A
Host: dev
Domain: vibez.now
Value: 13.56.236.209
TTL: 60 seconds
```

## AWS Security Group Configuration

Ensure the following inbound rules are configured:
- **SSH**: Port 22 (already configured)
- **HTTP**: Port 80 - Source: 0.0.0.0/0
- **HTTPS**: Port 443 - Source: 0.0.0.0/0

## SSL/TLS Configuration (COMPLETED ✅)

SSL certificate has been successfully configured with Let's Encrypt:
- **Certificate for**: dev.vibez.now
- **Issued**: November 25, 2025
- **Expires**: February 23, 2026
- **Auto-renewal**: Configured (runs twice daily)

The certificate will automatically renew before expiration via cron job.

## Deploying Updates

Use the provided deployment script:
```bash
./deploy.sh
```

Or manually:
```bash
ssh -i /Users/williamschulz/Downloads/Vibez.now.pem ec2-user@ec2-13-56-236-209.us-west-1.compute.amazonaws.com
cd ~/vibez-now-backend
git pull origin master
source ~/.nvm/nvm.sh
npm install
pm2 restart vibez-now-backend
```

## Useful Commands

### PM2 Management
```bash
pm2 status              # Check application status
pm2 logs               # View real-time logs
pm2 logs --lines 100   # View last 100 log lines
pm2 restart all        # Restart application
pm2 stop all           # Stop application
pm2 monit              # Monitor CPU/Memory usage
```

### Nginx Management
```bash
sudo systemctl status nginx   # Check Nginx status
sudo systemctl restart nginx  # Restart Nginx
sudo nginx -t                 # Test Nginx configuration
sudo tail -f /var/log/nginx/vibez-now-access.log  # View access logs
sudo tail -f /var/log/nginx/vibez-now-error.log   # View error logs
```

### Application Logs
```bash
pm2 logs vibez-now-backend --lines 50
```

## API Endpoints

Your API is now live and accessible via HTTPS:

- **Health Check**: `https://dev.vibez.now/health`
- **API Info**: `https://dev.vibez.now/api/v1`
- **Vibez Endpoint**: `https://dev.vibez.now/api/v1/vibez`

HTTP requests are automatically redirected to HTTPS.

## Troubleshooting

### Application won't start
```bash
pm2 logs vibez-now-backend --err --lines 50
cd ~/vibez-now-backend
source ~/.nvm/nvm.sh
node server.js  # Test directly
```

### Nginx issues
```bash
sudo nginx -t
sudo systemctl status nginx
sudo tail -f /var/log/nginx/error.log
```

### SSL certificate issues
```bash
sudo certbot certificates
sudo certbot renew --dry-run
```

## Monitoring

Set up PM2 monitoring (optional):
```bash
pm2 install pm2-logrotate  # Automatic log rotation
```

## Security Considerations

1. Keep Security Group rules restrictive
2. Regularly update system packages: `sudo yum update -y`
3. Monitor PM2 logs for errors
4. Review Nginx access logs for suspicious activity
5. Keep SSL certificates up to date (Certbot auto-renews)
