# 01 - Infrastructure Setup

## Overview

This document provides step-by-step instructions for Claude Code to set up all infrastructure components via browser automation.

**Claude Code will:**
1. Access DigitalOcean, Twilio, ElevenLabs dashboards via Chrome
2. Check for existing resources to reuse
3. Create new resources as needed
4. Configure integrations
5. Save credentials to .env.local

---

## Prerequisites

Before starting, ensure:
- [ ] DigitalOcean account exists with payment method
- [ ] Twilio account exists with payment method
- [ ] ElevenLabs account exists (Creator/Pro plan for Conversational AI)
- [ ] Domain name available (or use DigitalOcean App Platform subdomain)
- [ ] User has logged into all accounts in Chrome

---

## Phase 1: DigitalOcean VPS Setup

### Step 1.1: Check Existing Resources

```
INSTRUCTIONS FOR CLAUDE CODE:

1. Navigate to https://cloud.digitalocean.com/droplets
2. Check if any existing droplet can be reused:
   - Look for droplet with name containing "voqo" or "demo"
   - Check if droplet has Ubuntu 22.04 or 24.04
   - Check if droplet has at least 2GB RAM
3. If suitable droplet exists:
   - Note its IP address
   - Skip to Step 1.4 (SSH setup)
4. If no suitable droplet:
   - Proceed to Step 1.2
```

### Step 1.2: Create New Droplet

```
INSTRUCTIONS FOR CLAUDE CODE:

1. Click "Create" → "Droplets"
2. Configure:
   - Region: Sydney (syd1) - closest to Australian users
   - Image: Ubuntu 24.04 LTS
   - Size: Basic → Regular → $12/mo (2GB RAM, 1 vCPU, 50GB SSD)
   - Authentication: SSH Key (preferred) or Password
   - Hostname: voqo-demo
   - Enable backups: No (demo only)
   - Add tags: voqo, demo

3. Click "Create Droplet"
4. Wait for droplet to provision (1-2 minutes)
5. Note the IP address

OUTPUT REQUIRED:
- Droplet IP: xxx.xxx.xxx.xxx
```

### Step 1.3: Configure Firewall

```
INSTRUCTIONS FOR CLAUDE CODE:

1. Navigate to Networking → Firewalls
2. Check if firewall "voqo-firewall" exists
3. If not, create new firewall:
   - Name: voqo-firewall
   - Inbound Rules:
     - SSH: TCP 22 from All IPv4, All IPv6
     - HTTP: TCP 80 from All IPv4, All IPv6
     - HTTPS: TCP 443 from All IPv4, All IPv6
   - Outbound Rules: All TCP, All UDP (default)
4. Apply firewall to voqo-demo droplet
```

### Step 1.4: Initial Server Setup

```
INSTRUCTIONS FOR CLAUDE CODE:

SSH into the droplet and run these commands:

# Update system
apt update && apt upgrade -y

# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Install PM2 for process management
npm install -g pm2

# Install nginx
apt install -y nginx

# Install certbot for SSL
apt install -y certbot python3-certbot-nginx

# Create app directory
mkdir -p /var/www/voqo-demo
chown -R $USER:$USER /var/www/voqo-demo

# Verify installations
node --version  # Should be v20.x.x
npm --version
pm2 --version
nginx -v
```

### Step 1.5: Configure Nginx

```
INSTRUCTIONS FOR CLAUDE CODE:

Create nginx config at /etc/nginx/sites-available/voqo-demo:

server {
    listen 80;
    server_name voqo-demo.example.com;  # Replace with actual domain or IP

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
    }

    # Serve static files directly
    location /demo/ {
        alias /var/www/voqo-demo/public/demo/;
        try_files $uri $uri.html =404;
    }

    location /call/ {
        alias /var/www/voqo-demo/public/call/;
        try_files $uri $uri.html =404;
    }
}

Then:
ln -s /etc/nginx/sites-available/voqo-demo /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

### Step 1.6: SSL Certificate (if domain available)

```
INSTRUCTIONS FOR CLAUDE CODE:

If using a custom domain:
certbot --nginx -d voqo-demo.example.com

If using IP only (no SSL):
- Skip this step
- Use http:// for webhooks during development
- Consider using ngrok for HTTPS tunneling
```

---

## Phase 2: Twilio Setup

### Step 2.1: Check Existing Resources

```
INSTRUCTIONS FOR CLAUDE CODE:

1. Navigate to https://console.twilio.com
2. Note Account SID and Auth Token from dashboard
3. Go to Phone Numbers → Manage → Active Numbers
4. Check if Australian number (+61) exists
5. If exists:
   - Note the phone number
   - Check current webhook configuration
   - Skip to Step 2.4
6. If not:
   - Proceed to Step 2.2
```

### Step 2.2: Regulatory Bundle (Required for Australian Numbers)

```
INSTRUCTIONS FOR CLAUDE CODE:

1. Navigate to Phone Numbers → Regulatory Compliance → Bundles
2. Check if approved Australian bundle exists
3. If not, create new bundle:
   - Click "Create a Bundle"
   - Select "Australia" as country
   - Select "Local" number type
   - Fill business information:
     - Business Name: [User's business]
     - Business Type: [User's business type]
     - Address: Australian address required
   - Upload required documents if prompted
   - Submit for review

4. Wait for approval (can take 1-3 business days)
   - Status should show "Approved" or "Twilio Approved"

NOTE: If regulatory bundle is pending, cannot proceed with number purchase.
      Ask user to wait or use existing number if available.
```

### Step 2.3: Purchase Australian Phone Number

```
INSTRUCTIONS FOR CLAUDE CODE:

1. Navigate to Phone Numbers → Manage → Buy a Number
2. Search:
   - Country: Australia
   - Type: Local (cheapest at $3/mo)
   - Capabilities: Voice (required), SMS (optional but recommended)
3. Select a number from Sydney area code if available
4. Purchase the number
5. Note the full number in E.164 format: +61XXXXXXXXX

OUTPUT REQUIRED:
- Phone Number: +61XXXXXXXXX
```

### Step 2.4: Note Credentials

```
INSTRUCTIONS FOR CLAUDE CODE:

Navigate to console.twilio.com and collect:

1. Account SID: ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
2. Auth Token: (click to reveal) xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
3. Phone Number: +61XXXXXXXXX

DO NOT configure webhooks yet - ElevenLabs will do this automatically.
```

---

## Phase 3: ElevenLabs Setup

### Step 3.1: Check Existing Resources

```
INSTRUCTIONS FOR CLAUDE CODE:

1. Navigate to https://elevenlabs.io
2. Click "Conversational AI" or "Agents" in sidebar
3. Check if any existing agent can be reused:
   - Look for agent named "Voqo Demo" or similar
   - Check if agent has Australian voice configured
4. If suitable agent exists:
   - Note the Agent ID
   - Skip to Step 3.4 (phone number import)
5. If not:
   - Proceed to Step 3.2
```

### Step 3.2: Create Conversational AI Agent

```
INSTRUCTIONS FOR CLAUDE CODE:

1. Click "Create Agent" or "+ New Agent"
2. Configure Agent:

   NAME: Voqo Real Estate Demo

   FIRST MESSAGE:
   "Hi! Thanks for calling {{agency_name}}. I'm their AI assistant. How can I help you today?"

   SYSTEM PROMPT (paste exactly):
   """
   You are a friendly AI receptionist for {{agency_name}}, a real estate agency located in {{agency_location}}.

   PERSONALITY:
   - Warm, professional, and helpful
   - Australian conversational style (casual but polite)
   - Brief responses (1-2 sentences max)
   - Never pushy or salesy

   YOUR ROLE:
   - Greet callers warmly
   - Understand their property needs
   - Collect key information for follow-up

   INFORMATION TO GATHER (in natural conversation):
   1. Intent: Are they looking to buy, sell, or rent?
   2. Location: What suburb or area interests them?
   3. Budget: What's their price range? (ask gently, optional)
   4. Name: Can I get your name for our records?

   CONVERSATION FLOW:
   - Start with understanding their needs
   - Ask 2-3 questions maximum
   - Don't interrogate - keep it natural
   - If they give all info quickly, move to closing

   CLOSING (after gathering info):
   Say something like:
   "Perfect! I'm putting together some tailored information for you right now. You'll see it appear on the page you called from in just a moment. Thanks so much for calling {{agency_name}}!"

   IMPORTANT RULES:
   - Never pretend to have access to specific listings
   - Never make up property details
   - Never promise specific callback times
   - If asked something you don't know, say "I'll make sure one of our agents follows up with that information"
   - Keep calls under 2 minutes
   - Maximum 4 questions before closing
   """

3. Voice Configuration:
   - Browse Voice Library
   - Filter: Australian accent, Female (or Male based on preference)
   - Recommended: Natural, professional tone
   - Test voice before selecting

4. LLM Configuration:
   - Model: GPT-4o (recommended for speed + quality)
   - Temperature: 0.7 (balanced)

5. Advanced Settings:
   - Turn timeout: 10 seconds
   - Max conversation duration: 180 seconds (3 minutes)

6. Save agent

OUTPUT REQUIRED:
- Agent ID: (from URL or settings)
```

### Step 3.3: Configure Data Collection

```
INSTRUCTIONS FOR CLAUDE CODE:

1. In agent settings, find "Data Collection" or "Extracted Variables"
2. Configure extraction for:

   VARIABLE: caller_intent
   DESCRIPTION: Whether caller wants to buy, sell, or rent
   TYPE: enum (buy, sell, rent, other)

   VARIABLE: preferred_location
   DESCRIPTION: Suburb or area the caller is interested in
   TYPE: string

   VARIABLE: budget_range
   DESCRIPTION: Caller's budget or price range if mentioned
   TYPE: string

   VARIABLE: caller_name
   DESCRIPTION: The caller's name
   TYPE: string

3. Save configuration
```

### Step 3.4: Import Twilio Phone Number

```
INSTRUCTIONS FOR CLAUDE CODE:

1. In ElevenLabs, go to "Phone Numbers" or "Telephony" section
2. Click "Import Number" or "Add Phone Number"
3. Select "Twilio" as provider
4. Enter:
   - Phone Number: +61XXXXXXXXX (from Twilio)
   - Twilio Account SID: ACxxxxxxxx (from Twilio)
   - Twilio Auth Token: xxxxxxxx (from Twilio)
5. Click Import/Save
6. Wait for verification (should be instant)
7. Assign agent: Select "Voqo Real Estate Demo" agent

NOTE: This automatically configures Twilio webhooks. Do not manually change Twilio voice webhook settings after this.
```

### Step 3.5: Configure Webhooks

```
INSTRUCTIONS FOR CLAUDE CODE:

1. In ElevenLabs agent settings, find "Webhooks" section
2. Configure Post-Call Webhook:
   - URL: https://voqo-demo.example.com/api/webhook/call-complete
   - Events: post_call_transcription (enable)
   - Authentication: Note the signing secret if provided

3. Configure Personalization Webhook (CRITICAL):
   - URL: https://voqo-demo.example.com/api/webhook/personalize
   - This is called BEFORE each call to get dynamic variables

4. Save webhook configuration

OUTPUT REQUIRED:
- Webhook signing secret (if any)
```

### Step 3.6: Note All Credentials

```
INSTRUCTIONS FOR CLAUDE CODE:

Collect and save all credentials:

ELEVENLABS:
- API Key: (from Profile → API Keys)
- Agent ID: (from agent URL or settings)
- Webhook Secret: (if configured)

Save these to be added to .env.local later.
```

---

## Phase 4: Final Configuration

### Step 4.1: Create Environment File

```
INSTRUCTIONS FOR CLAUDE CODE:

Create /var/www/voqo-demo/.env.local with all collected credentials:

# Twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+61XXXXXXXXX

# ElevenLabs
ELEVENLABS_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
ELEVENLABS_AGENT_ID=xxxxxxxxxxxxxxxxxxxxxxxx

# App
NEXT_PUBLIC_APP_URL=https://voqo-demo.example.com
NEXT_PUBLIC_DEMO_PHONE=+61 XXX XXX XXX

# Security
WEBHOOK_SECRET=xxxxxxxxxxxxxxxx
```

### Step 4.2: Test Connectivity

```
INSTRUCTIONS FOR CLAUDE CODE:

1. Test Twilio:
   - Navigate to Twilio Console → Phone Numbers
   - Verify webhook URLs are set by ElevenLabs

2. Test ElevenLabs:
   - Make a test call to the Twilio number
   - Verify agent answers
   - Check webhooks fire (view logs if available)

3. Test VPS:
   - SSH to server
   - Verify nginx is running: systemctl status nginx
   - Test port 80: curl localhost

4. Report any issues for debugging
```

---

## Phase 5: Domain Configuration (Optional)

### If Using Custom Domain

```
INSTRUCTIONS FOR CLAUDE CODE:

1. Get VPS IP address from DigitalOcean

2. Configure DNS (in domain registrar or DigitalOcean DNS):
   - A Record: voqo-demo.example.com → VPS_IP
   - Wait for DNS propagation (5-30 minutes)

3. Verify DNS:
   - ping voqo-demo.example.com
   - Should resolve to VPS IP

4. Get SSL certificate:
   - SSH to VPS
   - Run: certbot --nginx -d voqo-demo.example.com
   - Follow prompts

5. Update all webhook URLs to use https://
```

### If Using IP Only (Development)

```
For development without domain:
- Use http://IP_ADDRESS for webhooks
- OR use ngrok for HTTPS tunnel:

  # On VPS
  npm install -g ngrok
  ngrok http 3000

  # Use ngrok URL for webhooks
  # Note: URL changes on restart
```

---

## Checklist

Before proceeding to application build:

- [ ] DigitalOcean droplet running with Node.js, nginx
- [ ] Firewall configured (ports 80, 443, 22)
- [ ] Twilio account with Australian phone number
- [ ] ElevenLabs agent created and configured
- [ ] Twilio number imported to ElevenLabs
- [ ] Webhooks configured (personalize + call-complete)
- [ ] All credentials saved to .env.local
- [ ] Test call successful (agent answers)

---

## Troubleshooting

### Twilio number not working with ElevenLabs
- Verify Account SID and Auth Token are correct
- Check Twilio console for error logs
- Ensure number has Voice capability

### ElevenLabs agent not responding
- Check agent is assigned to phone number
- Verify agent is not paused/disabled
- Check ElevenLabs quota/billing

### Webhooks not firing
- Verify URLs are accessible from internet
- Check nginx is proxying correctly
- Look at ElevenLabs webhook logs

### SSL certificate issues
- Ensure DNS is properly configured
- Check nginx config syntax: nginx -t
- Verify domain points to VPS IP
