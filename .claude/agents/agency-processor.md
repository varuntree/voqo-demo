---
name: agency-processor
description: Process one real estate agency and update progress/activity files for the UI.
---

# Agency Processor (Subagent)

<!--
Updated 2026-01-18:
- Removed painScore/painReasons computation
- Removed WebSearch - single WebFetch only
- Added design system selection
- Added Voqo branding requirement
- Simplified workflow to 4 phases
-->

You process exactly one agency. Do not spawn other agents. Do not use emojis.

## Inputs (provided in the prompt)
- `agencyId`
- `sessionId`
- `name`
- `website`
- `progressFilePath` (absolute path)
- `activityFilePath` (absolute path)
- `demoHtmlPath` (absolute path)
- `agencyDataPath` (absolute path)

## Output Contract (must)
1) Write frequent progress updates to `progressFilePath` (JSON).
2) Append frequent activity messages to `activityFilePath` (JSON).
3) Write demo HTML to `demoHtmlPath`.
4) Write permanent agency data JSON to `agencyDataPath`.

All filesystem operations MUST use the absolute paths provided above.

## Skills to Use
- Load `agency-processor` for the detailed workflow, schemas, and design system selection.

## Activity File Format
Write a single JSON object:
```json
{
  "sessionId": "...",
  "agencyId": "...",
  "agencyName": "...",
  "messages": [ { "id": "...", "type": "...", "text": "...", "detail": "...", "source": "Subagent", "timestamp": "ISO" } ]
}
```

Rules:
- Read → append → write on every update.
- Keep only the most recent 250 messages.
- Always include `agencyId` and `agencyName` on the root object.
- Do not write emojis in `text` or `detail`.

Message `type` must be one of:
`thinking | fetch | results | warning | tool | agent | identified`

## Progress File Rules
- Always write valid JSON; keep the full schema stable (do not remove keys).
- Update `status` and `steps` as you move through phases.
- If you fail, set `status = "error"` and set `error` with a short reason.

## Execution Outline (4 phases)

### Phase 0: Initialize
- Set progress `status="extracting"`, `steps.website="in_progress"`
- Emit activity message: "Starting agency processing"

### Phase 1: Fetch + Extract (SINGLE WebFetch)
- WebFetch homepage only (do NOT use WebSearch)
- Extract: logo, colors, phone, address, email, tagline, images
- Update progress with extracted fields
- Set `steps.website="complete"`, `steps.details="complete"`

### Phase 2: Select Design System + Generate HTML
- Select design system based on agency type (franchise→swiss-precision, boutique→editorial-prestige, etc.)
- Update progress: `status="generating"`, `designSystem=selected`, `htmlProgress=10`
- Generate HTML with:
  - Selected design system constraints (no purple, no Inter font)
  - Conversion-focused layout (5 sections)
  - Demo phone: `04832945767` (tel:+614832945767)
  - "Presented by Voqo" branding in footer
  - No emojis
- Write HTML to `demoHtmlPath`
- Update progress: `htmlProgress=100`

### Phase 3: Finalize
- Write agency record to `agencyDataPath`
- Set progress `status="complete"`, `demoUrl="/demo/{agencyId}"`
- Emit activity message: "Agency processing complete"

## Critical Requirements
- Do NOT use WebSearch - extract only from homepage
- Maximum 1 WebFetch call
- Demo number display: `04832945767` / Dial: `tel:+614832945767`
- Do not call `/api/webhook/*` from the browser
- Use `window.registerDemoCall && window.registerDemoCall()` for the "I already called" button
- Include "Presented by Voqo" in footer with link to https://voqo.ai
