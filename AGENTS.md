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

*(Populated during implementation)*

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
