# 08 - Build Sequence

## Overview

This document provides the exact step-by-step execution order for building the VoqoLeadEngine. Each phase builds on the previous, with clear checkpoints and verification steps.

**Executor:** Claude Code (autonomous execution)
**Environment:** Single DigitalOcean VPS
**Accounts:** User provides access to DigitalOcean, Twilio, ElevenLabs

---

## Phase Summary

| Phase | Description | Dependencies |
|-------|-------------|--------------|
| 1 | Infrastructure Setup | Account access |
| 2 | Next.js Project Setup | VPS ready |
| 3 | Skills & Prompts Setup | Project initialized |
| 4 | API Routes Implementation | Skills ready |
| 5 | UI Implementation | API routes ready |
| 6 | ElevenLabs Agent Setup | Webhooks deployed |
| 7 | Integration Testing | All components ready |
| 8 | Demo Preparation | System working |

---

## Phase 1: Infrastructure Setup

**Reference:** `01-infrastructure-setup.md`

### Step 1.1: DigitalOcean VPS

```
ACTIONS:
1. Access DigitalOcean dashboard via Chrome
2. Check for existing droplet named "voqo*" or suitable Ubuntu VPS
3. If none exists:
   - Create droplet: Ubuntu 24.04, $12/mo (2GB), Sydney region
   - Name: voqo-demo
   - Note IP address
4. Configure firewall (80, 443, 22)
5. SSH into droplet

INSTALL:
apt update && apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs nginx certbot python3-certbot-nginx
npm install -g pm2

VERIFY:
node --version  # v20.x
nginx -v
pm2 --version

OUTPUT:
- VPS_IP: xxx.xxx.xxx.xxx
- SSH access confirmed
```

### Step 1.2: Twilio Setup

```
ACTIONS:
1. Access Twilio console via Chrome
2. Note Account SID and Auth Token
3. Check for existing Australian number (+61)
4. If none:
   - Create regulatory bundle (if needed)
   - Purchase Australian local number
5. Note phone number

DO NOT configure webhooks (ElevenLabs will do this)

OUTPUT:
- TWILIO_ACCOUNT_SID: ACxxxxx
- TWILIO_AUTH_TOKEN: xxxxx
- TWILIO_PHONE_NUMBER: +61xxxxxxxxx
```

### Step 1.3: ElevenLabs Setup (Partial)

```
ACTIONS:
1. Access ElevenLabs dashboard via Chrome
2. Note API key from profile
3. Check for existing Conversational AI agent
4. If none exists, note to create after webhooks are deployed

OUTPUT:
- ELEVENLABS_API_KEY: xxxxx
- Agent creation deferred to Phase 6
```

### Checkpoint 1
- [ ] VPS accessible via SSH
- [ ] Node.js 20+ installed
- [ ] Nginx running
- [ ] Twilio credentials noted
- [ ] ElevenLabs API key noted

---

## Phase 2: Next.js Project Setup

### Step 2.1: Initialize Project

```bash
# On VPS
cd /var/www
npx create-next-app@latest voqo-demo --typescript --tailwind --app --no-eslint
cd voqo-demo
```

### Step 2.2: Create Directory Structure

```bash
# Create directories
mkdir -p .claude/skills/agency-researcher
mkdir -p .claude/skills/demo-page-builder
mkdir -p .claude/skills/postcall-page-builder
mkdir -p data/agencies
mkdir -p data/calls
mkdir -p data/context
mkdir -p public/demo
mkdir -p public/call
mkdir -p lib

# Set permissions
chmod -R 755 data public
```

### Step 2.3: Create Environment File

```bash
# Create .env.local
cat > .env.local << 'EOF'
# Twilio
TWILIO_ACCOUNT_SID=ACxxxxx
TWILIO_AUTH_TOKEN=xxxxx
TWILIO_PHONE_NUMBER=+61xxxxxxxxx

# ElevenLabs
ELEVENLABS_API_KEY=xxxxx
ELEVENLABS_AGENT_ID=pending

# App
NEXT_PUBLIC_APP_URL=http://VPS_IP:3000
NEXT_PUBLIC_DEMO_PHONE=+61 XXX XXX XXX
EOF
```

### Step 2.4: Install Dependencies

```bash
npm install twilio
```

### Step 2.5: Configure Nginx

```bash
# Create nginx config
cat > /etc/nginx/sites-available/voqo-demo << 'EOF'
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }

    location /demo/ {
        alias /var/www/voqo-demo/public/demo/;
        try_files $uri $uri.html =404;
    }

    location /call/ {
        alias /var/www/voqo-demo/public/call/;
        try_files $uri $uri.html =404;
    }
}
EOF

# Enable site
ln -sf /etc/nginx/sites-available/voqo-demo /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

### Step 2.6: Start Development Server

```bash
cd /var/www/voqo-demo
npm run build
pm2 start npm --name voqo-demo -- start
pm2 save
```

### Checkpoint 2
- [ ] Next.js app running on port 3000
- [ ] Nginx proxying to app
- [ ] Directory structure created
- [ ] Environment variables set
- [ ] App accessible at http://VPS_IP

---

## Phase 3: Skills Setup

**Reference:** `02-agency-researcher-skill.md`, `03-demo-page-skill.md`, `04-postcall-page-skill.md`

### Step 3.1: Create Agency Researcher Skill

```bash
cat > .claude/skills/agency-researcher/SKILL.md << 'EOF'
[INSERT FULL CONTENT FROM 02-agency-researcher-skill.md]
EOF
```

### Step 3.2: Create Demo Page Builder Skill

```bash
cat > .claude/skills/demo-page-builder/SKILL.md << 'EOF'
[INSERT FULL CONTENT FROM 03-demo-page-skill.md]
EOF
```

### Step 3.3: Create Post-Call Page Builder Skill

```bash
cat > .claude/skills/postcall-page-builder/SKILL.md << 'EOF'
[INSERT FULL CONTENT FROM 04-postcall-page-skill.md]
EOF
```

### Step 3.4: Create CLAUDE.md

```bash
cat > CLAUDE.md << 'EOF'
# VoqoLeadEngine

This is a lead generation demo for Voqo AI.

## Available Skills

- agency-researcher: Find and qualify real estate agencies
- demo-page-builder: Generate branded demo landing pages
- postcall-page-builder: Generate post-call pages from transcripts

## Project Structure

- /data/agencies/ - Agency JSON data
- /data/calls/ - Call transcripts and results
- /public/demo/ - Generated demo HTML pages
- /public/call/ - Generated post-call HTML pages

## Guidelines

- Always use Tailwind CSS via CDN in generated HTML
- Save all data as JSON files
- Use web search for real-time data
- Generate static HTML files
EOF
```

### Checkpoint 3
- [ ] All three skills created in .claude/skills/
- [ ] CLAUDE.md created in project root
- [ ] Skills contain full content from spec docs

---

## Phase 4: API Routes Implementation

**Reference:** `06-webhook-handler.md`

### Step 4.1: Create Helper Library

```typescript
// lib/claude.ts
// Helper for invoking Claude Code (placeholder - actual implementation depends on setup)

export async function invokeClaudeCode(options: {
  prompt: string;
  tools?: string[];
  skills?: string[];
}): Promise<void> {
  // Implementation: subprocess call to claude-code CLI
  // or SDK integration
  console.log('Claude Code invocation:', options.prompt.substring(0, 100));
}
```

```typescript
// lib/twilio.ts
import Twilio from 'twilio';

const client = new Twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

export async function sendSMS(to: string, message: string) {
  return client.messages.create({
    body: message,
    to,
    from: process.env.TWILIO_PHONE_NUMBER!,
  });
}
```

### Step 4.2: Create API Routes

Create these files in `app/api/`:

1. `app/api/search/route.ts` - Trigger agency search
2. `app/api/generate-demo/route.ts` - Generate demo page
3. `app/api/register-call/route.ts` - Store call context
4. `app/api/call-status/route.ts` - Poll for page status
5. `app/api/webhook/personalize/route.ts` - ElevenLabs personalization
6. `app/api/webhook/call-complete/route.ts` - Post-call handler

**Implementation:** Follow code from `06-webhook-handler.md`

### Step 4.3: Test API Routes

```bash
# Test register-call
curl -X POST http://localhost:3000/api/register-call \
  -H "Content-Type: application/json" \
  -d '{"agencyData":{"id":"test","name":"Test Agency"},"timestamp":1234567890}'

# Test personalize webhook
curl -X POST http://localhost:3000/api/webhook/personalize \
  -H "Content-Type: application/json" \
  -d '{"caller_id":"+61400000000","agent_id":"test","called_number":"+61200000000","call_sid":"CA123"}'
```

### Checkpoint 4
- [ ] All API routes created
- [ ] Routes return valid responses
- [ ] File read/write working in /data
- [ ] No runtime errors

---

## Phase 5: UI Implementation

### Step 5.1: Main Search Page

```typescript
// app/page.tsx
// Main search interface with:
// - Suburb search input
// - Loading state during search
// - Agency results list with pain scores
// - [Generate Demo] buttons
```

**Key UI elements:**
- Search input with submit button
- Results grid showing agencies
- Pain score badges
- Generate Demo buttons that trigger /api/generate-demo
- Loading states

### Step 5.2: Demo Page Route

```typescript
// app/demo/[slug]/page.tsx
// Serves static HTML from /public/demo/[slug].html
// Or shows "generating" if page doesn't exist yet
```

### Step 5.3: Post-Call Page Route

```typescript
// app/call/[id]/page.tsx
// Serves static HTML from /public/call/[id].html
// Or shows "generating" state
```

### Step 5.4: Build and Test UI

```bash
npm run build
pm2 restart voqo-demo
```

### Checkpoint 5
- [ ] Search page loads at /
- [ ] Can enter suburb and see loading
- [ ] Demo pages accessible at /demo/[slug]
- [ ] Call pages accessible at /call/[id]

---

## Phase 6: ElevenLabs Agent Setup

**Reference:** `05-voice-agent-prompt.md`

**Prerequisite:** Webhooks must be accessible from internet

### Step 6.1: Verify Webhook Accessibility

```bash
# From external machine or using ngrok
curl http://VPS_IP/api/webhook/personalize
# Should return JSON (even if error)
```

### Step 6.2: Create ElevenLabs Agent (via Chrome)

```
ACTIONS:
1. Access ElevenLabs Agents Platform
2. Create new Conversational AI agent
3. Configure:
   - Name: Voqo Real Estate Demo
   - First Message: [from 05-voice-agent-prompt.md]
   - System Prompt: [from 05-voice-agent-prompt.md]
   - Voice: Australian female
   - LLM: GPT-4o
   - Max Duration: 180 seconds
4. Configure Data Collection:
   - caller_name, caller_intent, preferred_location, budget_range
5. Configure Webhooks:
   - Personalization: http://VPS_IP/api/webhook/personalize
   - Post-call: http://VPS_IP/api/webhook/call-complete
   - Event: post_call_transcription
6. Import Twilio number:
   - Enter phone number, Account SID, Auth Token
   - Assign agent to number
7. Note Agent ID

OUTPUT:
- ELEVENLABS_AGENT_ID: xxxxx
```

### Step 6.3: Update Environment

```bash
# Update .env.local with agent ID
sed -i 's/ELEVENLABS_AGENT_ID=pending/ELEVENLABS_AGENT_ID=actual_id/' .env.local
pm2 restart voqo-demo
```

### Checkpoint 6
- [ ] ElevenLabs agent created
- [ ] Webhooks configured
- [ ] Twilio number imported and assigned
- [ ] Agent ID saved to .env.local

---

## Phase 7: Integration Testing

### Step 7.1: Test Agency Search

```
1. Go to http://VPS_IP
2. Enter "Surry Hills" in search
3. Wait for results (may take 1-2 minutes)
4. Verify agencies appear with pain scores
5. Check /data/agencies/surry-hills.json exists
```

### Step 7.2: Test Demo Page Generation

```
1. Click [Generate Demo] for an agency
2. Wait for page generation
3. Verify redirect to /demo/[agency-id]
4. Check page displays with correct branding
5. Verify /public/demo/[agency-id].html exists
```

### Step 7.3: Test Voice Call Flow

```
1. On demo page, click "Call Demo"
2. Verify /api/register-call was called (check server logs)
3. Dial the Twilio number from a phone
4. Verify voice agent answers with agency name
5. Complete conversation (give name, intent, location)
6. Wait for call to end
7. Check /api/webhook/call-complete received data
8. Wait for post-call page generation
9. Verify page appears in demo page or at /call/[id]
```

### Step 7.4: Test Full End-to-End

```
1. Fresh search for new suburb
2. Generate demo for agency
3. Make call from demo page
4. Complete voice conversation
5. See personalized post-call page with listings
```

### Checkpoint 7
- [ ] Agency search returns results
- [ ] Demo pages generate correctly
- [ ] Voice agent answers with correct context
- [ ] Post-call pages generate with listings
- [ ] Full flow works end-to-end

---

## Phase 8: Demo Preparation

### Step 8.1: Pre-Generate Demo Data

```
ACTIONS:
1. Search "Surry Hills" and generate top 5 demo pages
2. Search "Darlinghurst" and generate top 3 demo pages
3. Verify all pages load correctly
4. Make 1-2 test calls to verify voice flow
```

### Step 8.2: Create Demo Script

```
DEMO FLOW:
1. Show main search page
2. "Watch as we find agencies in Surry Hills..."
3. Show results with pain scores
4. "Let's generate a personalized demo for Ray White..."
5. Show branded demo page
6. "Now let's call and see what happens..."
7. Make call, have conversation
8. "And here's the magic - a personalized page..."
9. Show post-call page with listings
```

### Step 8.3: Backup Demo Content

```bash
# Save generated content for demo
tar -czf demo-backup.tar.gz \
  /data/agencies \
  /public/demo \
  /public/call
```

### Step 8.4: Final Verification

```
CHECK:
- [ ] VPS is stable and responsive
- [ ] All demo pages load < 3 seconds
- [ ] Voice agent responds naturally
- [ ] Post-call pages generate < 2 minutes
- [ ] No console errors in browser
- [ ] Mobile responsive
```

### Checkpoint 8
- [ ] Demo data pre-generated
- [ ] Demo script ready
- [ ] Backup created
- [ ] System stable

---

## Troubleshooting

### VPS Issues
- Check PM2 logs: `pm2 logs voqo-demo`
- Check nginx: `systemctl status nginx`
- Check disk space: `df -h`

### API Route Errors
- Check Next.js build: `npm run build`
- Check file permissions: `ls -la /data`
- Check environment: `cat .env.local`

### Voice Agent Issues
- Verify webhooks accessible from internet
- Check ElevenLabs agent logs
- Verify Twilio number assigned to agent

### Page Generation Issues
- Check Claude Code can execute
- Verify skills are in .claude/skills/
- Check /data and /public write permissions

---

## Quick Reference Commands

```bash
# Restart app
pm2 restart voqo-demo

# View logs
pm2 logs voqo-demo

# Rebuild
npm run build && pm2 restart voqo-demo

# Check nginx
nginx -t && systemctl reload nginx

# Check data files
ls -la /data/agencies/
ls -la /data/calls/
ls -la /public/demo/

# Test webhook locally
curl -X POST http://localhost:3000/api/webhook/personalize \
  -H "Content-Type: application/json" \
  -d '{"caller_id":"+61400000000"}'
```

---

## Completion Criteria

The build is complete when:

1. **Search works:** Enter suburb → get agency list
2. **Demo pages work:** Click Generate → branded page appears
3. **Voice works:** Call number → agent speaks with context
4. **Post-call works:** After call → personalized page with listings
5. **Full flow works:** Search → Demo → Call → Post-call page

All of the above with real agency data, real branding, and real listings.
