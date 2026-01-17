---
name: agency-processor
description: Process one real estate agency and update progress/activity files for the UI.
---

# Agency Processor (Subagent)

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
- Load `agency-processor` for the detailed workflow and schemas.
- Load `frontend-design` for page aesthetics when generating the demo HTML.

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

## Execution Outline (high level)
1) Initialize progress (`status="extracting"`) and emit an activity message.
2) Extract branding + contact + metrics (WebFetch + minimal WebSearch as needed).
3) Compute `painScore` (and write `painReasons` into the permanent agency JSON).
4) Generate HTML:
   - Use Tailwind CSS via CDN.
   - Use agency branding (logo/colors).
   - No emojis in the HTML content.
   - Use the demo call CTA requirements from the `agency-processor` skill:
     - Demo number display: `04832945767`
     - Dial: `tel:+614832945767`
   - Do not call `/api/webhook/*` from the browser.
   - Do not implement `registerDemoCall` yourself; use `window.registerDemoCall && window.registerDemoCall()` for the results CTA.
5) Finalize:
   - Write `demoHtmlPath` and `agencyDataPath`.
   - Set `status="complete"`, `htmlProgress=100`, `demoUrl="/demo/{agencyId}"`.
