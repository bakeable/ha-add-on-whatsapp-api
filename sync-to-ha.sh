#!/bin/bash
# ==============================================================================
# Sync to Home Assistant Local Add-on
# Quickly push your local changes to HA for testing
# ==============================================================================

# Load configuration from .env file
if [ ! -f ".env" ]; then
    echo "❌ Error: .env file not found!"
    echo "   Please copy .env.example to .env and configure it."
    echo "   Run: cp .env.example .env"
    exit 1
fi

source .env

# Validate required variables
if [ -z "$HA_HOST" ] || [ -z "$HA_USER" ]; then
    echo "❌ Error: HA_HOST and HA_USER must be set in .env file"
    exit 1
fi

ADDON_NAME="${ADDON_NAME:-whatsapp_gateway}"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🔄 Syncing WhatsApp Gateway to Home Assistant...${NC}"
echo "   Host: $HA_USER@$HA_HOST"
echo "   Path: /addons/local/$ADDON_NAME"
echo ""

# Check if HA is reachable
if ! ping -c 1 -W 1 "$HA_HOST" > /dev/null 2>&1; then
    echo -e "${RED}❌ Cannot reach $HA_HOST${NC}"
    echo "   Make sure Home Assistant is running and accessible"
    exit 1
fi

# Ensure the target directory exists
echo -e "${YELLOW}📁 Ensuring directory exists...${NC}"

# Test SSH connection first
if ! ssh -o ConnectTimeout=5 "$HA_USER@$HA_HOST" "echo 'SSH OK'" > /dev/null 2>&1; then
    echo -e "${RED}❌ Cannot connect via SSH to $HA_USER@$HA_HOST${NC}"
    echo ""
    echo "Troubleshooting:"
    echo "  1. Enable SSH access in Home Assistant"
    echo "  2. Install 'SSH & Web Terminal' or 'Advanced SSH & Web Terminal' add-on"
    echo "  3. Set up SSH key: ssh-copy-id $HA_USER@$HA_HOST"
    echo "  4. Or check your .env file settings"
    exit 1
fi

# For HAOS, we need sudo to access /addons
echo -e "${YELLOW}🔑 Creating directory (may require sudo)...${NC}"
ssh "$HA_USER@$HA_HOST" "sudo mkdir -p /addons/local/$ADDON_NAME && sudo chown $HA_USER:$HA_USER /addons/local/$ADDON_NAME" 2>&1

# Verify it worked
if ! ssh "$HA_USER@$HA_HOST" "test -w /addons/local/$ADDON_NAME" 2>/dev/null; then
    echo -e "${RED}❌ Cannot create or write to /addons/local/$ADDON_NAME${NC}"
    echo ""
    echo "The directory exists but you don't have write permissions."
    echo "This is normal on Home Assistant OS."
    echo ""
    echo "Quick fix - run this on your HA (via SSH):"
    echo "  sudo mkdir -p /addons/local/$ADDON_NAME"
    echo "  sudo chown $HA_USER:$HA_USER /addons/local/$ADDON_NAME"
    echo ""
    echo "Then run 'make sync' again."
    exit 1
fi

# Build the UI first
echo -e "${YELLOW}📦 Building UI...${NC}"
cd evolution_api/gateway/ui
npm run build
cd ../../..

# Sync files
echo -e "${YELLOW}📤 Syncing files...${NC}"
rsync -avz \
  --delete \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude '.gitignore' \
  --exclude 'dist' \
  --exclude 'cypress' \
  --exclude 'screenshots' \
  --exclude '.vite' \
  --exclude 'coverage' \
  --exclude '*.log' \
  evolution_api/ "$HA_USER@$HA_HOST:/addons/local/$ADDON_NAME/"

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Sync complete!${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Go to Settings → Add-ons in Home Assistant"
    echo "  2. Find 'WhatsApp Gateway' under Local add-ons"
    echo ""
    echo "  First time setup:"
    echo "    - Click 'Install'"
    echo "    - Configure settings"
    echo "    - Click 'Start'"
    echo ""
    echo "  After code changes:"
    echo "    - Click 'Rebuild'"
    echo "    - Click 'Restart'"
    echo ""
    echo "  Or via SSH:"
    echo "    ssh $HA_USER@$HA_HOST"
    echo "    ha addons rebuild local_$ADDON_NAME"
    echo "    ha addons restart local_$ADDON_NAME"
    echo ""
else
    echo ""
    echo -e "${RED}❌ Sync failed${NC}"
    echo ""
    echo "Troubleshooting:"
    echo "  1. Check SSH connection: ssh $HA_USER@$HA_HOST"
    echo "  2. Verify directory permissions on HA"
    echo "  3. Check rsync is installed: ssh $HA_USER@$HA_HOST 'which rsync'"
    echo "  4. Try manual sync:"
    echo "     scp -r evolution_api/* $HA_USER@$HA_HOST:/addons/local/$ADDON_NAME/"
    exit 1
fi
