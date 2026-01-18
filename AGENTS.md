# VoqoLeadEngine - Working Knowledge

## Build & Run

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run start        # Start production
```

## Validation

```bash
npm run build                              # Verify build succeeds
curl localhost:3000/api/register-call      # Test API route
curl localhost:3000/api/webhook/personalize # Test webhook
```

## E2E Testing

- Use Chrome tools (`mcp__claude-in-chrome__*`)
- Take screenshots as evidence
- Test ngrok webhook accessibility: `curl https://[ngrok-url]/api/webhook/personalize`

## Project Structure

```
app/                 # Next.js App Router
  api/               # API routes (webhooks, search, etc.)
  demo/[slug]/       # Demo page route
  call/[id]/         # Post-call page route
.claude/skills/      # Claude Code skills
data/                # Runtime JSON storage
  agencies/          # Agency research results
  calls/             # Call transcripts
  context/           # Pending call context
public/              # Generated HTML pages
  demo/              # Demo landing pages
  call/              # Post-call pages
lib/                 # Helpers (twilio, claude)
specs/               # Specification documents
plans/               # Generated phase plans
```

## Key Patterns

*(Updated during implementation)*

- File storage: JSON in `/data`, HTML in `/public`
- API routes: Next.js App Router format (`app/api/*/route.ts`)
- Styling: Tailwind CSS via CDN in generated HTML
- Context injection: `pending-calls.json` with 5-minute TTL
- Webhook matching: Most recent pending context within time window

## Credentials Location

- `.env.local` - All API keys and config
- Never commit `.env.local`

## Discovered Gotchas

- Next.js 16 uses Tailwind v4 with `@tailwindcss/postcss` plugin instead of `tailwind.config.ts`
- Port 3000 may be occupied; Next.js auto-selects next available port (check terminal output)
- scmp package deprecated warning on twilio install - harmless

## External Service URLs

| Service | Console URL |
|---------|------------|
| Twilio | https://console.twilio.com |
| ElevenLabs | https://elevenlabs.io |
| DigitalOcean | https://cloud.digitalocean.com |

## Documentation References

- `CLAUDE.md` - Project overview for Claude Code
- `specs/` - Full specifications
- `IMPLEMENTATION_PLAN.md` - Progress tracking
- `plans/phase-*.md` - Detailed phase plans

## Git Workflow (Commit Local Changes to `main`)

```bash
cd /Users/varunprasad/code/prjs/voqo-demo
git checkout main
git pull --rebase origin main

# sanity check before committing
npm run build

git status
git add -A
git commit -m "Describe change"
git push origin main
```

Rules:
- Never commit `.env.local`.
- Never commit runtime artifacts: `data/`, `public/demo/`, `public/call/`.

## VPS Sync + Restart (Careful Deploy)

Goal: Update code to match local repo state, rebuild, and restart, without losing VPS runtime state.

### Runtime directories to preserve on VPS

- `/var/www/voqo-demo/data`
- `/var/www/voqo-demo/public/demo`
- `/var/www/voqo-demo/public/call`

### Option A (Preferred): Pull on VPS (if `/var/www/voqo-demo` is a git clone)

```bash
ssh voqo@170.64.163.27
cd /var/www/voqo-demo
git pull --ff-only
npm ci
npm run build
pm2 restart voqo-demo || pm2 start npm --name voqo-demo -- start
pm2 save
```

### Option B (Guaranteed to match local): `rsync` local → VPS (recommended for unpushed changes)

```bash
cd /Users/varunprasad/code/prjs/voqo-demo

# Sync code only (preserves VPS runtime state + secrets)
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
  ./ voqo@170.64.163.27:/var/www/voqo-demo/

# Rebuild + restart on VPS as the app user
ssh voqo@170.64.163.27 \
  'cd /var/www/voqo-demo && npm ci && npm run build && (pm2 restart voqo-demo || pm2 start npm --name voqo-demo -- start) && pm2 save'
```

### Critical Gotcha: `EADDRINUSE :::3000` (two PM2 daemons)

If the app “won’t update” or `pm2` shows restart loops with `EADDRINUSE`, it’s usually because the app is running under *root* PM2 while you’re restarting under *voqo* (or vice versa). Nginx expects the app on port `3000`.

```bash
# Check root PM2 (should be empty / not running voqo-demo)
ssh root@170.64.163.27 'pm2 status; pm2 delete voqo-demo || true'

# Check voqo PM2 (this should be the one running)
ssh voqo@170.64.163.27 'pm2 status'

# Verify what is listening on :3000
ssh voqo@170.64.163.27 'ss -ltnp | grep :3000 || true'
```
