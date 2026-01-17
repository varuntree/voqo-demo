# Deployment Reference

## VPS Configuration

| Field | Value |
|-------|-------|
| Provider | DigitalOcean |
| Droplet Name | voqo-demo |
| IP Address | 170.64.163.27 |
| Region | Sydney (SYD1) |
| Size | 8 GB RAM / 4 vCPUs / 50 GB SSD |
| OS | Ubuntu 24.04 LTS |
| Cost | $48/month |
| Domain | theagentic.engineer |

---

## Installed Software

| Package | Version |
|---------|---------|
| Node.js | v20.20.0 |
| npm | 10.8.2 |
| PM2 | 6.0.14 |
| Nginx | 1.24.0 |
| Certbot | 2.9.0 |
| Claude Code | Latest |

---

## Directory Structure

```
/var/www/voqo-demo/           # Application root
├── .env.local                # Production secrets (600)
├── ecosystem.config.js       # PM2 configuration
├── .next/                    # Build output
└── ...

/etc/nginx/sites-available/voqo-demo    # Nginx config
/etc/letsencrypt/live/theagentic.engineer/  # SSL certs
```

---

## Production URLs

| Purpose | URL |
|---------|-----|
| Main Site | https://theagentic.engineer |
| Personalize Webhook | https://theagentic.engineer/api/webhook/personalize |
| Call Complete Webhook | https://theagentic.engineer/api/webhook/call-complete |
| Demo Phone | +614832945767 (display: 04832945767) |

---

## SSH Access

```bash
# As root
ssh root@170.64.163.27

# As voqo (app user)
ssh voqo@170.64.163.27
```

---

## App Management

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

---

## Deploy Code Updates

```bash
# From local machine
rsync -avz --progress \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='.git' \
  --exclude='.env' \
  --exclude='.env.local' \
  --exclude='data' \
  --exclude='public/demo' \
  --exclude='public/call' \
  --exclude='pnpm-lock.yaml' \
  /Users/varunprasad/code/prjs/voqo-demo/ \
  root@170.64.163.27:/var/www/voqo-demo/

# Then on VPS
ssh root@170.64.163.27
chown -R voqo:voqo /var/www/voqo-demo
su - voqo -c "cd /var/www/voqo-demo && npm install && npm run build && pm2 restart voqo-demo"
```

Alternative (preferred if `/var/www/voqo-demo` is a git clone):
```bash
ssh voqo@170.64.163.27
cd /var/www/voqo-demo
git pull --ff-only
npm ci
npm run build
pm2 restart voqo-demo
```

---

## Claude Code on VPS

```bash
# Test Claude Code
ssh voqo@170.64.163.27
~/.local/bin/claude -p "say hello" --dangerously-skip-permissions

# Re-authenticate if needed
~/.local/bin/claude login
```

---

## Troubleshooting

### Claude Code not found
- Cause: CLI not in PATH for PM2
- Fix: ecosystem.config.js sets PATH to include /home/voqo/.local/bin

### 504 Gateway Timeout
- Cause: Default Nginx timeout too short
- Fix: Increase proxy timeouts to 300s in nginx config

### OOM Killer
- Cause: RAM exhausted by parallel subagents
- Fix: Upgraded to 8GB RAM

### Claude Code auth error
- Cause: Auth done as root but app runs as voqo
- Fix: SSH as voqo and run `~/.local/bin/claude login`

---

## SSL Certificate

- Path: /etc/letsencrypt/live/theagentic.engineer/
- Expires: 2026-04-16
- Auto-renew: enabled via certbot

---

## Firewall (UFW)

```
22/tcp                     ALLOW IN    Anywhere
80/tcp                     ALLOW IN    Anywhere
443/tcp                    ALLOW IN    Anywhere
```

Note: ICMP (ping) is blocked by design.
