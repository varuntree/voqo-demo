---
name: agency-processor
description: Extract agency data and generate a demo page with real-time progress + activity updates (no emojis).
---

# Agency Processor Skill (Single Agency)

You process exactly one real-estate agency end-to-end:
1) Quickly extract branding + contact + light metrics.
2) Write a durable agency record used by the system.
3) Generate a branded demo landing page.
4) Continuously update progress + activity so the UI streams smoothly.

Hard rules:
- Do not spawn other agents.
- Do not use emojis in any text you write.
- Use only the absolute paths provided in the prompt.

## Inputs (from the prompt)
- `agencyId`: URL-safe slug (example: `ray-white-surry-hills`)
- `sessionId`: pipeline session ID
- `name`: agency name (best-effort)
- `website`: agency website URL
- `progressFilePath`: absolute path to `data/progress/agency-{agencyId}.json`
- `activityFilePath`: absolute path to `data/progress/agency-activity-{agencyId}.json`
- `demoHtmlPath`: absolute path to `public/demo/{agencyId}.html`
- `agencyDataPath`: absolute path to `data/agencies/{agencyId}.json`

## Tools Allowed
- Use only: `WebFetch`, `WebSearch`, `Read`, `Write`, `Glob`
- No browser automation tools.

## Output Files (must write all)

### 1) Activity Stream (`activityFilePath`)
Store a single JSON object and append to `messages`:
```json
{
  "sessionId": "pipe-...",
  "agencyId": "ray-white-surry-hills",
  "agencyName": "Ray White Surry Hills",
  "messages": [
    {
      "id": "msg-<timestamp>-<rand>",
      "type": "thinking|tool|fetch|results|identified|warning",
      "text": "Short, user-facing update",
      "detail": "Optional: URL or query",
      "source": "Subagent",
      "timestamp": "2026-01-17T12:34:56.789Z"
    }
  ]
}
```
Rules:
- Every `id` must be unique.
- Before each `WebFetch`/`WebSearch`, append a `tool` message with `detail` set to the URL/query.
- After each milestone, append a short `identified/results/thinking` message.
- Keep only the last 250 messages.

### 2) Progress File (`progressFilePath`)
Always write valid JSON with stable keys:
```json
{
  "agencyId": "...",
  "sessionId": "...",
  "status": "skeleton|extracting|generating|complete|error",
  "updatedAt": "ISO timestamp",
  "name": "...",
  "website": "...",
  "phone": null,
  "address": null,
  "logoUrl": null,
  "primaryColor": null,
  "secondaryColor": null,
  "teamSize": null,
  "listingCount": null,
  "painScore": null,
  "soldCount": null,
  "priceRangeMin": null,
  "priceRangeMax": null,
  "forRentCount": null,
  "htmlProgress": 0,
  "demoUrl": null,
  "steps": [
    { "id": "website", "label": "Found website", "status": "pending|in_progress|complete|error" },
    { "id": "details", "label": "Extracted details", "status": "pending|in_progress|complete|error" },
    { "id": "generating", "label": "Generating demo page", "status": "pending|in_progress|complete|error" },
    { "id": "complete", "label": "Ready", "status": "pending|in_progress|complete|error" }
  ],
  "error": null
}
```
Rules:
- Update `updatedAt` on every write.
- Never remove keys; set missing fields to `null`.

### 3) Agency Record (`agencyDataPath`)
Write the durable record used by the rest of the system. Follow this shape:
```json
{
  "id": "ray-white-surry-hills",
  "name": "Ray White Surry Hills",
  "website": "https://...",
  "phone": "02 ...",
  "email": null,
  "address": "Full street address",
  "branding": {
    "logoUrl": null,
    "primaryColor": "#0f172a",
    "secondaryColor": "#ffffff"
  },
  "metrics": {
    "teamSize": 0,
    "listingCount": 0,
    "soldCount": null,
    "forRentCount": null,
    "priceRangeMin": null,
    "priceRangeMax": null,
    "hasPropertyManagement": false,
    "hasAfterHoursNumber": false,
    "hasChatWidget": false,
    "hasOnlineBooking": false,
    "principalName": null
  },
  "painScore": 0,
  "painReasons": [],
  "researchedAt": "ISO timestamp",
  "dataQuality": "complete|partial|minimal",
  "notes": null,
  "demoPage": {
    "generated": true,
    "generatedAt": "ISO timestamp",
    "url": "/demo/ray-white-surry-hills"
  }
}
```

## Performance Targets
- Prefer ≤ 3 `WebFetch` total (homepage + 1–2 obvious subpages like “Contact”, “Team”, “Listings”).
- Prefer ≤ 1 `WebSearch` total (only if website does not expose the basics).
- If data is unclear after the budget, set unknown fields to `null`/defaults and proceed.

## Workflow (strict phases)

### Phase 0: Initialize
1) Append activity: `Starting agency processing`.
2) Write progress:
   - `status = "extracting"`
   - `steps.website = in_progress`

### Phase 1: Fetch + Extract (fast)
1) Before fetching, append activity:
   - `type: "tool"`, `detail: <website URL>`
2) `WebFetch` the homepage.
3) Update progress:
   - `steps.website = complete`
   - `steps.details = in_progress`
4) Extract and write (batch in 2–3 writes max):
   - `logoUrl` (prefer explicit logo; fallback to favicon)
   - `primaryColor` + `secondaryColor` (best-effort)
   - `phone`, `address`, `email` (if present)
   - `teamSize`, `listingCount`, `forRentCount`, `soldCount`, `priceRangeMin/max` (best-effort)
5) If critical fields are missing, optionally do one more `WebFetch` to a likely subpage (Contact/Team/Listings) and repeat extraction.

### Phase 2: Compute Pain Score
Compute `painScore` (0–100) + 3–6 concrete `painReasons` based on signals like:
- Listings vs team size
- After-hours coverage
- Missing conversion tooling (chat/booking)
- Rental/PM load

Write `painScore` to progress and agency record.

### Phase 3: Generate Demo Page (reliable call flow)
Important: The call flow is handled by the system at runtime. Do not implement webhook calls from the browser.

Hard requirements for the generated HTML:
- Full HTML document, Tailwind CSS via CDN.
- No emojis in any text.
- Prominent demo call CTA that dials the *demo* number (not the agency’s own number):
  - Display: `04832945767`
  - Dial (E.164): `+614832945767`
- Include a secondary “I already called” CTA that can trigger results:
  - Use `onclick="window.registerDemoCall && window.registerDemoCall()"`
  - Do not implement `registerDemoCall` yourself.
- Never call `/api/webhook/*` from the browser.

Progress updates:
- Set `status="generating"`, `steps.details=complete`, `steps.generating=in_progress`, `htmlProgress=10`
- After drafting (before write): `htmlProgress=70`
- After writing: `htmlProgress=100`

Use the `frontend-design` skill for the overall aesthetic direction, but keep the call CTA behavior exactly as specified above.

### Phase 4: Finalize
1) Write `agencyDataPath` using the schema above.
2) Write progress:
   - `steps.generating=complete`, `steps.complete=complete`
   - `status="complete"`
   - `demoUrl="/demo/{agencyId}"`

## Error Handling
If a required fetch/search fails:
1) Append an activity `warning` with a short reason.
2) Write progress `status="error"`, set the relevant step to `error`, and set `error` string.
3) Stop (no retries).
