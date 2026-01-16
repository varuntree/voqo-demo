# Phase 8: VPS Deployment + Domain Setup

## What & Why
Deploy the application to DigitalOcean VPS, configure `theagentic.engineer` domain, and update all webhooks to permanent URLs. Eliminates ngrok dependency and enables stable production environment.

## Prerequisites
- DigitalOcean account logged in (Chrome)
- name.com account logged in (Chrome) - owns `theagentic.engineer`
- ElevenLabs account logged in (Chrome)
- All Phase 1-6 + 10 completed (application ready)
- Local codebase at `/Users/varunprasad/code/prjs/voqo-demo`

## Execution Split
| Action Type | Executor |
|-------------|----------|
| DigitalOcean droplet creation | Claude (Chrome) |
| VPS provisioning (SSH) | Claude (Bash) |
| Code deployment | Claude (rsync + SSH) |
| Nginx/SSL config | Claude (SSH) |
| Environment variables | Claude (SSH) |
| DNS config (name.com) | **USER** (Claude provides instructions) |
| ElevenLabs webhook update | **USER** (Claude provides instructions) |

## Security Measures
- [x] Firewall: Only ports 22, 80, 443 open (UFW)
- [x] SSH: Key-based auth, disable root password
- [x] Nginx: Hide server version
- [x] App: Run as non-root user `voqo`
- [x] Fail2ban: Block brute-force SSH attempts

---

## IMPLEMENTATION STEPS

### Step 8.1: Create DigitalOcean Droplet (Chrome)
**Why**: Need a VPS to host the application permanently

**Actions**:
1. Navigate to https://cloud.digitalocean.com/droplets
2. Click green "Create" button → select "Droplets"
3. Configure droplet:

   **Choose Region:**
   - Select "Sydney" (syd1) - closest to Australian users

   **Choose an image:**
   - Click "Ubuntu"
   - Select "24.04 (LTS) x64"

   **Choose Size:**
   - Click "Basic"
   - CPU options: "Regular" (not Premium)
   - Select "$12/mo" plan (2 GB RAM / 1 CPU / 50 GB SSD / 2 TB transfer)

   **Choose Authentication Method:**
   - Select "SSH Key" (recommended)
   - If no SSH key exists, click "New SSH Key"
     - On local machine run: `cat ~/.ssh/id_rsa.pub` or `cat ~/.ssh/id_ed25519.pub`
     - Paste the public key content
     - Name it: "macbook" or similar
   - OR select "Password" and set a strong root password (note it down)

   **Additional Options:**
   - Leave defaults (no backups needed for demo)

   **Finalize Details:**
   - Hostname: `voqo-demo`
   - Tags: `voqo`, `demo`

4. Click "Create Droplet"
5. Wait 30-60 seconds for provisioning
6. **Note the IP address** (e.g., `143.198.xxx.xxx`)

**Output Required:**
```
DROPLET_IP: [note this]
AUTH_METHOD: ssh-key OR password
ROOT_PASSWORD: [if password auth, note this]
```

**Verify**:
- [ ] Droplet shows "Running" status
- [ ] IP address visible

**Status**: [ ] Pending

---

### Step 8.2: Configure DigitalOcean Firewall (Chrome)
**Why**: Restrict inbound traffic to essential ports only

**Actions**:
1. In DigitalOcean, go to Networking → Firewalls (left sidebar)
2. Click "Create Firewall"
3. Configure:

   **Name:** `voqo-firewall`

   **Inbound Rules:** (delete any defaults first)
   | Type | Protocol | Port Range | Sources |
   |------|----------|------------|---------|
   | SSH | TCP | 22 | All IPv4, All IPv6 |
   | HTTP | TCP | 80 | All IPv4, All IPv6 |
   | HTTPS | TCP | 443 | All IPv4, All IPv6 |

   **Outbound Rules:**
   - Keep defaults (All TCP, All UDP to All IPv4/IPv6)

   **Apply to Droplets:**
   - Type "voqo-demo" and select it

4. Click "Create Firewall"

**Verify**:
- [ ] Firewall created and applied to droplet

**Status**: [ ] Pending

---

### Step 8.3: Initial SSH Connection Test (Bash)
**Why**: Verify we can connect to the VPS

**Actions**:
```bash
# Test SSH connection (replace IP)
ssh root@[DROPLET_IP]

# If prompted about fingerprint, type "yes"
# If password auth, enter the root password
```

**Verify**:
- [ ] Successfully logged into VPS
- [ ] See Ubuntu welcome message

**Status**: [ ] Pending

---

### Step 8.4: Provision VPS Server (SSH)
**Why**: Install Node.js, Nginx, PM2, security tools

**Actions** (run on VPS after SSH):
```bash
# Update system packages
apt update && apt upgrade -y

# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Verify Node.js
node --version   # Should show v20.x.x
npm --version    # Should show 10.x.x

# Install PM2 globally
npm install -g pm2

# Install Nginx
apt install -y nginx

# Install Certbot for SSL
apt install -y certbot python3-certbot-nginx

# Install fail2ban for SSH protection
apt install -y fail2ban
systemctl enable fail2ban
systemctl start fail2ban

# Create app directory
mkdir -p /var/www/voqo-demo

# Verify all installations
echo "=== Installation Check ==="
node --version
npm --version
pm2 --version
nginx -v
certbot --version
systemctl status fail2ban --no-pager | head -5
```

**Expected Output**:
```
Node: v20.x.x
npm: 10.x.x
PM2: 5.x.x
Nginx: nginx/1.x.x
Certbot: certbot 2.x.x
Fail2ban: active (running)
```

**Verify**:
- [ ] Node.js v20 installed
- [ ] PM2 installed
- [ ] Nginx installed and running
- [ ] Certbot installed
- [ ] Fail2ban active

**Status**: [ ] Pending

---

### Step 8.5: Security Hardening (SSH)
**Why**: Basic security to protect the VPS

**Actions** (run on VPS):
```bash
# Configure UFW firewall (additional layer)
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'
ufw --force enable

# Verify UFW
ufw status verbose

# Hide Nginx version in headers
sed -i 's/# server_tokens off;/server_tokens off;/' /etc/nginx/nginx.conf

# Create non-root user for running the app
adduser --disabled-password --gecos "Voqo App" voqo

# Set ownership of app directory
chown -R voqo:voqo /var/www/voqo-demo

# Verify user created
id voqo
```

**Verify**:
- [ ] UFW active with 3 rules (22, 80, 443)
- [ ] User `voqo` created

**Status**: [ ] Pending

---

### Step 8.6: Configure Nginx (SSH)
**Why**: Nginx proxies requests to Next.js and handles SSL

**Actions** (run on VPS):
```bash
# Create Nginx config file
cat > /etc/nginx/sites-available/voqo-demo << 'EOF'
server {
    listen 80;
    server_name theagentic.engineer www.theagentic.engineer;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeout settings for long-running requests
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
EOF

# Enable the site
ln -sf /etc/nginx/sites-available/voqo-demo /etc/nginx/sites-enabled/

# Remove default site
rm -f /etc/nginx/sites-enabled/default

# Test Nginx config
nginx -t

# Reload Nginx
systemctl reload nginx

# Verify Nginx is running
systemctl status nginx --no-pager | head -5
```

**Expected Output**:
```
nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
nginx: configuration file /etc/nginx/nginx.conf test is successful
```

**Verify**:
- [ ] `nginx -t` shows syntax ok
- [ ] Nginx reloaded successfully

**Status**: [ ] Pending

---

### Step 8.7: Deploy Application Code (Local + SSH)
**Why**: Transfer codebase from local machine to VPS

**Actions** (run from LOCAL machine, not VPS):
```bash
# From local machine, rsync code to VPS
# Replace [DROPLET_IP] with actual IP

rsync -avz --progress \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='.git' \
  --exclude='.env.local' \
  /Users/varunprasad/code/prjs/voqo-demo/ \
  root@[DROPLET_IP]:/var/www/voqo-demo/

# Note: We exclude .env.local because we'll create it with production values
```

**Then SSH back to VPS and install dependencies**:
```bash
ssh root@[DROPLET_IP]

# Change to app directory
cd /var/www/voqo-demo

# Set ownership
chown -R voqo:voqo /var/www/voqo-demo

# Install dependencies as voqo user
su - voqo -c "cd /var/www/voqo-demo && npm install"

# Verify package.json exists
ls -la /var/www/voqo-demo/package.json
```

**Verify**:
- [ ] Files transferred to VPS
- [ ] `npm install` completed successfully
- [ ] node_modules directory created

**Status**: [ ] Pending

---

### Step 8.8: Configure Production Environment Variables (SSH)
**Why**: App needs correct credentials and production URL

**Actions** (run on VPS):
```bash
# Create production .env.local
# Copy values from your local .env.local file
cat > /var/www/voqo-demo/.env.local << 'EOF'
# Twilio
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone_number

# ElevenLabs
ELEVENLABS_API_KEY=your_elevenlabs_api_key
ELEVENLABS_AGENT_ID=your_elevenlabs_agent_id
ELEVENLABS_WEBHOOK_SECRET=your_elevenlabs_webhook_secret

# App - PRODUCTION URL
NEXT_PUBLIC_APP_URL=https://theagentic.engineer
NEXT_PUBLIC_DEMO_PHONE=+61 483 943 567
EOF

# Set correct ownership and permissions
chown voqo:voqo /var/www/voqo-demo/.env.local
chmod 600 /var/www/voqo-demo/.env.local

# Verify
ls -la /var/www/voqo-demo/.env.local
cat /var/www/voqo-demo/.env.local | head -3
```

**Verify**:
- [ ] .env.local created with production URL
- [ ] File owned by voqo user
- [ ] Permissions are 600 (secure)

**Status**: [ ] Pending

---

### Step 8.9: Build Application (SSH)
**Why**: Create production build of Next.js app

**Actions** (run on VPS):
```bash
# Build as voqo user
su - voqo -c "cd /var/www/voqo-demo && npm run build"

# This will take 1-2 minutes
# Watch for any errors

# Verify build succeeded
ls -la /var/www/voqo-demo/.next/
```

**Expected**: Build completes without errors, `.next/` directory created

**Verify**:
- [ ] `npm run build` completed successfully
- [ ] `.next/` directory exists

**Status**: [ ] Pending

---

### Step 8.10: Start Application with PM2 (SSH)
**Why**: PM2 keeps app running, auto-restarts on crash, starts on boot

**Actions** (run on VPS):
```bash
# Start the app with PM2 as voqo user
su - voqo -c "cd /var/www/voqo-demo && pm2 start npm --name 'voqo-demo' -- start"

# Save PM2 process list
su - voqo -c "pm2 save"

# Configure PM2 to start on system boot
# First, get the startup command
pm2 startup systemd -u voqo --hp /home/voqo

# Run the command it outputs (looks like: sudo env PATH=... pm2 startup...)

# Verify app is running
su - voqo -c "pm2 status"
su - voqo -c "pm2 logs voqo-demo --lines 10"

# Test local access
curl -s localhost:3000 | head -20
```

**Verify**:
- [ ] PM2 shows voqo-demo status: "online"
- [ ] `curl localhost:3000` returns HTML
- [ ] No errors in PM2 logs

**Status**: [ ] Pending

---

### Step 8.11: Configure DNS in name.com (USER ACTION)
**Why**: Point theagentic.engineer to VPS IP

**Instructions for USER**:

1. Go to https://www.name.com and login
2. Click "My Domains" in top navigation
3. Click on "theagentic.engineer"
4. Click "Manage DNS Records" or "DNS" tab
5. Delete any existing A records for @ or www (if any)
6. Add new A Record:
   ```
   Type: A
   Host: @
   Value: [DROPLET_IP]   ← Replace with actual IP from Step 8.1
   TTL: 300
   ```
7. Add second A Record:
   ```
   Type: A
   Host: www
   Value: [DROPLET_IP]   ← Same IP
   TTL: 300
   ```
8. Click Save/Apply

**Verify DNS propagation** (after 5-30 minutes):
```bash
# Run from local machine
ping theagentic.engineer
# Should show [DROPLET_IP]

# Or use online tool
# https://dnschecker.org/#A/theagentic.engineer
```

**Status**: [ ] Pending (USER)

---

### Step 8.12: Configure SSL Certificate (SSH)
**Why**: HTTPS required for webhooks and security

**Prerequisites**: DNS must be propagated (Step 8.11 completed, wait 5-30 min)

**Actions** (run on VPS):
```bash
# Test DNS resolution first
ping -c 2 theagentic.engineer

# If ping works, get SSL certificate
certbot --nginx -d theagentic.engineer -d www.theagentic.engineer

# Follow prompts:
# - Enter email: [your email for renewal notices]
# - Agree to terms: Y
# - Share email with EFF: N (optional)
# - Redirect HTTP to HTTPS: 2 (recommended)

# Verify certificate
certbot certificates

# Test auto-renewal
certbot renew --dry-run
```

**Verify**:
- [ ] Certificate installed successfully
- [ ] `certbot certificates` shows valid cert
- [ ] Dry run renewal succeeds

**Status**: [ ] Pending

---

### Step 8.13: Test HTTPS Access (SSH + Browser)
**Why**: Verify site is accessible via HTTPS

**Actions**:
```bash
# From VPS, test with curl
curl -I https://theagentic.engineer

# Should return HTTP/2 200
```

**From browser**:
1. Visit https://theagentic.engineer
2. Verify padlock icon shows (secure)
3. Verify page loads correctly
4. Visit http://theagentic.engineer - should redirect to https

**Verify**:
- [ ] HTTPS works with valid certificate
- [ ] HTTP redirects to HTTPS
- [ ] Page loads correctly

**Status**: [ ] Pending

---

### Step 8.14: Update ElevenLabs Webhooks (USER ACTION)
**Why**: Point webhooks to permanent production URL

**Instructions for USER**:

1. Go to https://elevenlabs.io and login
2. Click "Conversational AI" in left sidebar
3. Click on "Voqo Real Estate Demo" agent
4. Go to "Settings" or "Agent Settings"
5. Find "Webhooks" section
6. Update **Personalization Webhook**:
   ```
   URL: https://theagentic.engineer/api/webhook/personalize
   ```
   (Replace whatever ngrok URL was there)

7. Update **Post-Call Webhook**:
   ```
   URL: https://theagentic.engineer/api/webhook/call-complete
   ```
   (Make sure "Transcript" toggle is ON)

8. Save changes

**Verify by making test call**:
- Call +61 483 943 567
- Agent should answer with agency context
- Check VPS logs: `pm2 logs voqo-demo`

**Status**: [ ] Pending (USER)

---

### Step 8.15: Full Production Test
**Why**: Verify complete end-to-end flow works

**Test Checklist**:

1. **Website Access**:
   - [ ] https://theagentic.engineer loads
   - [ ] Main search page displays

2. **API Endpoints**:
   ```bash
   # Test register-call endpoint
   curl -X POST https://theagentic.engineer/api/register-call \
     -H "Content-Type: application/json" \
     -d '{"agencyData":{"id":"test-prod","name":"Test Agency"},"timestamp":'$(date +%s)'}'

   # Should return {"success":true,"contextId":"..."}
   ```

3. **Voice Call Flow**:
   - Call +61 483 943 567
   - Agent answers with agency greeting
   - Have brief conversation (name, intent, location)
   - Call ends normally

4. **Post-Call Processing**:
   - Check VPS logs: `pm2 logs voqo-demo --lines 50`
   - Verify webhook received
   - Check for page generation in `/var/www/voqo-demo/public/call/`

5. **SMS Delivery**:
   - If caller provided number, SMS should arrive with page link

**Status**: [ ] Pending

---

### Step 8.16: Phase Checkpoint
**Why**: Confirm all deployment tasks complete

**Final Verification**:
- [ ] VPS running Ubuntu 24.04 with Node.js 20, Nginx, PM2
- [ ] Security: UFW firewall, fail2ban, non-root user
- [ ] Application deployed and built
- [ ] SSL certificate active (HTTPS works)
- [ ] DNS configured: theagentic.engineer → VPS IP
- [ ] ElevenLabs webhooks updated to production URLs
- [ ] Full voice call flow works on production
- [ ] No more ngrok dependency

**Status**: [ ] Pending

---

## QUICK REFERENCE

### VPS Access
```bash
ssh root@[DROPLET_IP]
# or
ssh voqo@[DROPLET_IP]
```

### App Management
```bash
# View app status
su - voqo -c "pm2 status"

# View logs
su - voqo -c "pm2 logs voqo-demo"

# Restart app
su - voqo -c "pm2 restart voqo-demo"

# Rebuild after code changes
su - voqo -c "cd /var/www/voqo-demo && npm run build && pm2 restart voqo-demo"
```

### Deploy Code Updates
```bash
# From local machine
rsync -avz --progress \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='.git' \
  --exclude='.env.local' \
  /Users/varunprasad/code/prjs/voqo-demo/ \
  root@[DROPLET_IP]:/var/www/voqo-demo/

# Then on VPS
ssh root@[DROPLET_IP]
chown -R voqo:voqo /var/www/voqo-demo
su - voqo -c "cd /var/www/voqo-demo && npm run build && pm2 restart voqo-demo"
```

### Important URLs
| Service | URL |
|---------|-----|
| Production Site | https://theagentic.engineer |
| Personalize Webhook | https://theagentic.engineer/api/webhook/personalize |
| Call Complete Webhook | https://theagentic.engineer/api/webhook/call-complete |
| Demo Phone | +61 483 943 567 |

### Environment Variables (Production)
```
NEXT_PUBLIC_APP_URL=https://theagentic.engineer
NEXT_PUBLIC_DEMO_PHONE=+61 483 943 567
```

---

## ROLLBACK PLAN

If production fails and need to revert to local dev:

1. Update ElevenLabs webhooks back to ngrok:
   - Personalize: `https://[ngrok-url]/api/webhook/personalize`
   - Call Complete: `https://[ngrok-url]/api/webhook/call-complete`

2. Start ngrok locally:
   ```bash
   ngrok http 3000
   ```

3. Start local dev server:
   ```bash
   npm run dev
   ```

4. Debug VPS issues while local setup handles calls
