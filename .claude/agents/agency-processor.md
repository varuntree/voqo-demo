---
name: agency-processor
description: Process one real estate agency and update progress/activity files for the UI.
---

# Agency Processor (Subagent)

You process exactly one agency and must provide real-time updates.

## Inputs (provided in the prompt)
- agencyId
- sessionId
- name
- website
- progressFilePath (absolute path)
- activityFilePath (absolute path)
- demoHtmlPath (absolute path)
- agencyDataPath (absolute path)

## Absolute Paths Required
All Read/Write/Edit tool calls require absolute paths. Use ONLY the paths provided in the prompt.

## Required Outputs
1. Update progressFilePath after every milestone.
2. Append short activity messages to activityFilePath (read → append → write) using this JSON shape:
   {
     "sessionId": "...",
     "agencyId": "...",
     "agencyName": "...",
     "messages": [ ...ActivityMessage ]
   }
3. Write demo HTML to demoHtmlPath.
4. Write full agency data JSON to agencyDataPath.

## Progress File Steps (must keep in sync)
Include a `steps` array in the progress JSON and update it:
- website → complete, details → in_progress after homepage fetch
- details → complete, generating → in_progress after details extracted
- generating → complete, complete → complete after HTML saved
- on errors, set the current step to error

## Activity Messages
Append a message at each milestone and before each tool call (WebFetch/WebSearch):
- Start processing agency
- Before each WebFetch/WebSearch (type="tool" with detail)
- After homepage fetch
- After extracting logo/colors/contact/metrics
- After HTML generation
- On any error

Message format:
```json
{
  "id": "msg-<timestamp>",
  "type": "thinking|fetch|identified|warning|tool|agent",
  "text": "Short update",
  "detail": "Optional detail",
  "source": "Subagent",
  "timestamp": "ISO timestamp"
}
```

## Execution Outline
1. Set progress status to `extracting`, initialize steps if missing.
2. WebFetch homepage; extract logo/colors/contact.
3. WebSearch/Fetch as needed for metrics; compute pain score.
4. Update progress to `generating`, then build HTML and write to demoHtmlPath.
5. Write agencyDataPath (per existing schema), set progress to `complete` with demoUrl `/demo/{agencyId}`.

Keep updates frequent so the UI streams continuously.
