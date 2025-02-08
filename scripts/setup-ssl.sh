#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Let's Encrypt SSL Certificate Setup Script${NC}\n"

# Check if domain name is provided
if [ -z "$1" ]; then
    echo -e "${YELLOW}Usage: ./setup-ssl.sh yourdomain.com${NC}"
    exit 1
fi

DOMAIN=$1

echo -e "Setting up SSL for domain: ${GREEN}$DOMAIN${NC}\n"

echo -e "${YELLOW}Step 1: Installing Certbot${NC}"
echo "Run these commands as root or with sudo:"
echo -e "${GREEN}sudo apt-get update"
echo "sudo apt-get install -y certbot"
echo -e "sudo apt-get install -y python3-certbot-nginx${NC}\n"

echo -e "${YELLOW}Step 2: Obtaining SSL Certificate${NC}"
echo -e "Run this command (replace yourdomain.com with your actual domain):"
echo -e "${GREEN}sudo certbot certonly --standalone -d $DOMAIN${NC}\n"

echo -e "${YELLOW}Step 3: Certificate Location${NC}"
echo "After successful certification, your certificates will be located at:"
echo -e "${GREEN}/etc/letsencrypt/live/$DOMAIN/fullchain.pem${NC} (certificate)"
echo -e "${GREEN}/etc/letsencrypt/live/$DOMAIN/privkey.pem${NC} (private key)\n"

echo -e "${YELLOW}Step 4: Update Environment Variables${NC}"
echo "Update your .env file with these paths:"
echo -e "${GREEN}SSL_CERT_PATH=/etc/letsencrypt/live/$DOMAIN/fullchain.pem"
echo -e "SSL_KEY_PATH=/etc/letsencrypt/live/$DOMAIN/privkey.pem"
echo -e "SSL_ENABLED=true${NC}\n"

echo -e "${YELLOW}Step 5: Auto-renewal Setup${NC}"
echo "Certbot automatically creates a renewal configuration."
echo "To test the renewal process, run:"
echo -e "${GREEN}sudo certbot renew --dry-run${NC}\n"

echo -e "${YELLOW}Step 6: Setup Auto-renewal Hook${NC}"
echo "Create a renewal hook to restart your application after certificate renewal:"
echo -e "${GREEN}sudo mkdir -p /etc/letsencrypt/renewal-hooks/post/"
echo "sudo tee /etc/letsencrypt/renewal-hooks/post/restart-app.sh > /dev/null << EOL
#!/bin/bash
systemctl restart my-profile-ltd
EOL"
echo -e "sudo chmod +x /etc/letsencrypt/renewal-hooks/post/restart-app.sh${NC}\n"

echo -e "${YELLOW}Important Notes:${NC}"
echo "1. Make sure port 80 is open and not in use during certificate acquisition"
echo "2. Certificates are valid for 90 days and will auto-renew"
echo "3. Keep your private key secure and never commit it to version control"
echo "4. Regular backups of /etc/letsencrypt directory are recommended"
echo -e "5. Monitor certificate expiration dates\n"

echo -e "${YELLOW}To run your application with the new certificates:${NC}"
echo "1. Stop your application if it's running"
echo "2. Update your .env file with the new certificate paths"
echo "3. Start your application"
echo -e "4. Test HTTPS access to your domain\n"

echo -e "${GREEN}Setup instructions complete!${NC}"
