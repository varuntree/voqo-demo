# 11 - Deployment Results

## VPS Configuration

| Field | Value |
|-------|-------|
| **Provider** | DigitalOcean |
| **Droplet Name** | voqo-demo |
| **IP Address** | 170.64.163.27 |
| **Region** | Sydney (SYD1) |
| **Size** | 8 GB RAM / 4 vCPUs / 50 GB SSD |
| **OS** | Ubuntu 24.04 LTS |
| **Cost** | $48/month |
| **Created** | 2026-01-16 |

## Step Completion Status

### Step 8.1: Create DigitalOcean Droplet
- **Status**: Complete
- **Result**: Droplet `voqo-demo` created at 170.64.163.27

### Step 8.2: Configure DigitalOcean Firewall
- **Status**: Complete
- **Firewall Name**: voqo-firewall
- **Inbound Rules**: SSH(22), HTTP(80), HTTPS(443)
- **Applied To**: voqo-demo

### Step 8.3: Initial SSH Connection Test
- **Status**: Complete
- **OS**: Ubuntu 24.04.3 LTS (Noble Numbat)
- **Kernel**: 6.8.0-71-generic x86_64

### Step 8.4: Provision VPS Server
- **Status**: Complete
- **Node.js**: v20.20.0
- **npm**: 10.8.2
- **PM2**: 6.0.14
- **Nginx**: 1.24.0
- **Certbot**: 2.9.0
- **fail2ban**: active (running)
- **App Dir**: /var/www/voqo-demo

### Step 8.5: Security Hardening
- **Status**: Complete
- **UFW**: active (22, 80, 443 allowed)
- **Nginx**: server_tokens off
- **User**: voqo (uid=1000)
- **App Ownership**: voqo:voqo

### Step 8.6: Configure Nginx
- **Status**: Complete
- **Config**: /etc/nginx/sites-available/voqo-demo
- **Domain**: theagentic.engineer
- **Proxy**: localhost:3000

### Step 8.7: Deploy Application Code
- **Status**: Complete
- **Method**: rsync
- **Dependencies**: 110 packages installed

### Step 8.8: Configure Production Environment Variables
- **Status**: Complete
- **File**: /var/www/voqo-demo/.env.local
- **Permissions**: 600 (secure)
- **Production URL**: https://theagentic.engineer

### Step 8.9: Build Application
- **Status**: Complete
- **Build Time**: ~27 seconds
- **Routes**: 11 (including API routes)

### Step 8.10: Start Application with PM2
- **Status**: Complete
- **Process**: voqo-demo (id: 0)
- **Status**: online
- **Startup**: enabled (pm2-voqo.service)

### Step 8.11: Configure DNS (USER ACTION)
- **Status**: Complete
- **Domain**: theagentic.engineer → 170.64.163.27
- **HTTP Test**: 200 OK
- **Required DNS Records**:
  - A @ -> 170.64.163.27
  - A www -> 170.64.163.27

### Step 8.12: Configure SSL Certificate
- **Status**: Complete
- **Certificate**: /etc/letsencrypt/live/theagentic.engineer/
- **Expires**: 2026-04-16
- **Auto-renew**: enabled

### Step 8.13: Test HTTPS Access
- **Status**: Complete
- **HTTPS**: 200 OK
- **HTTP→HTTPS**: 301 redirect working

### Step 8.14: Update ElevenLabs Webhooks (USER ACTION)
- **Status**: Complete
- **Personalize URL**: https://theagentic.engineer/api/webhook/personalize
- **Call Complete URL**: https://theagentic.engineer/api/webhook/call-complete
- **New Webhook Secret**: wsec_29df38c3...
- **Call Complete URL**: https://theagentic.engineer/api/webhook/call-complete

### Step 8.15: Full Production Test
- **Status**: Complete
- **Website**: ✅ Loads at https://theagentic.engineer
- **API register-call**: ✅ Works
- **Agency Search**: ✅ Works (Claude Code)
- **Demo Generation**: ✅ Works (Claude Code)
- **Voice Call**: ✅ Works (ElevenLabs + Twilio)
- **Post-call Page**: ✅ Works

### Claude Code Setup on VPS
- **Installed for root**: ✅
- **Installed for voqo**: ✅
- **Auth for root**: ✅
- **Auth for voqo**: ✅
- **PM2 ecosystem**: /var/www/voqo-demo/ecosystem.config.js
- **PATH configured**: /home/voqo/.local/bin added

### Step 8.16: Phase Checkpoint
- **Status**: Complete
- **All systems operational**: ✅

---

## Deployment Troubleshooting Log

### Issue 1: Claude Code not found
- **Symptom**: 500 error on /api/search and /api/generate-demo
- **Cause**: Claude Code CLI not installed on VPS
- **Solution**: Install Claude Code for voqo user via `curl -fsSL https://claude.ai/install.sh | bash`

### Issue 2: Claude Code not in PATH for PM2
- **Symptom**: "Claude Code process exited with code 1"
- **Cause**: PM2 didn't inherit the PATH with ~/.local/bin
- **Solution**: Create ecosystem.config.js with explicit PATH:
  ```javascript
  env: {
    PATH: '/home/voqo/.local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'
  }
  ```

### Issue 3: Claude Code authentication
- **Symptom**: "Invalid API key - Please run /login"
- **Cause**: Auth done for root user, but app runs as voqo
- **Solution**: SSH as voqo and run `~/.local/bin/claude login`

### Issue 4: SSH access for voqo user
- **Symptom**: "Permission denied (publickey)" when SSH'ing as voqo
- **Cause**: No SSH keys configured for voqo user
- **Solution**: Copy authorized_keys from root to voqo:
  ```bash
  cp /root/.ssh/authorized_keys /home/voqo/.ssh/
  chown -R voqo:voqo /home/voqo/.ssh
  ```

### Issue 5: Nginx Gateway Timeout (504)
- **Symptom**: 504 error on long-running Claude Code requests
- **Cause**: Default Nginx timeout (60s) too short
- **Solution**: Increase proxy timeouts to 300s in nginx config

### Issue 6: Ping timeout to domain
- **Symptom**: `ping theagentic.engineer` times out
- **Cause**: ICMP blocked by firewall (only TCP 22/80/443 allowed)
- **Status**: Expected behavior, not an issue

### Issue 7: OOM killer crash (Jan 17, 2026)
- **Symptom**: App crash-looping, `.next` build corrupted, 133+ PM2 restarts
- **Cause**: 2GB RAM exhausted by parallel Claude Code subagents during agency pipeline
- **Solution**: Upgraded VPS to 8GB RAM / 4 vCPUs ($48/mo)

---

## Quick Reference Commands

### SSH Access
```bash
# As root
ssh root@170.64.163.27

# As voqo (app user)
ssh voqo@170.64.163.27
```

### App Management
```bash
# View status
pm2 status

# View logs
pm2 logs voqo-demo

# Restart app
pm2 restart voqo-demo

# Full restart with ecosystem
cd /var/www/voqo-demo && pm2 delete voqo-demo && pm2 start ecosystem.config.js && pm2 save
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
  root@170.64.163.27:/var/www/voqo-demo/

# Then on VPS
ssh root@170.64.163.27
chown -R voqo:voqo /var/www/voqo-demo
su - voqo -c "cd /var/www/voqo-demo && npm install && npm run build && pm2 restart voqo-demo"
```

### Claude Code on VPS
```bash
# Test Claude Code
ssh voqo@170.64.163.27
~/.local/bin/claude -p "say hello" --dangerously-skip-permissions

# Re-authenticate if needed
~/.local/bin/claude login
```

---

## Important URLs (Production)

| Purpose | URL |
|---------|-----|
| Main Site | https://theagentic.engineer |
| Personalize Webhook | https://theagentic.engineer/api/webhook/personalize |
| Call Complete Webhook | https://theagentic.engineer/api/webhook/call-complete |
| Demo Phone | +61 483 943 567 |

---

## SSH Access

```bash
ssh root@170.64.163.27
```
