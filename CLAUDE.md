# VoqoLeadEngine

Lead generation demo for Voqo AI.

## Git Workflow (Commit to `main`)

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

Notes:
- Do not commit `.env.local`.
- Runtime artifacts should not be committed: `data/`, `public/demo/`, `public/call/`.

## Deploy to VPS (Sync + Restart, without losing runtime data)

This project stores runtime state on the VPS in `/var/www/voqo-demo/data` and generates HTML into `/var/www/voqo-demo/public/demo` and `/var/www/voqo-demo/public/call`. Deploys must preserve those.

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

### Option B (Guaranteed to match local): `rsync` from local → VPS

```bash
cd /Users/varunprasad/code/prjs/voqo-demo
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

ssh voqo@170.64.163.27 \
  'cd /var/www/voqo-demo && npm ci && npm run build && (pm2 restart voqo-demo || pm2 start npm --name voqo-demo -- start) && pm2 save'
```

### Critical Gotcha: Port 3000 conflicts (root vs `voqo` PM2)

If PM2 logs show `EADDRINUSE :::3000`, it usually means the app is already running under the *other* user’s PM2 daemon.

```bash
# Check and remove the root-owned PM2 app (if present)
ssh root@170.64.163.27 'pm2 status; pm2 delete voqo-demo || true'

# Ensure the `voqo` PM2 process is the only one running
ssh voqo@170.64.163.27 'pm2 status'
```

## Available Skills

- **agency-researcher**: Find and qualify real estate agencies in a suburb
- **demo-page-builder**: Generate branded demo landing pages (creative design)
- **postcall-page-builder**: Generate personalized post-call pages from transcripts

## Project Structure

- `/data/agencies/` - Agency JSON data
- `/data/calls/` - Call transcripts and results
- `/data/context/` - Pending call context
- `/public/demo/` - Generated demo HTML pages
- `/public/call/` - Generated post-call HTML pages

## Guidelines

- Use Tailwind CSS via CDN in all generated HTML
- Save data as JSON files
- Use web search for real-time data
- Generate static HTML files
- Design pages creatively - no rigid templates
- Prioritize mobile responsiveness
- Use smooth, subtle animations
