# VoqoLeadEngine Refactor Tracking

## Scope Checklist
- [x] Deterministic call-to-agency matching (context_id + fallbacks)
- [x] Durable post-call job queue + worker
- [x] Reliable post-call HTML generation with status updates
- [x] Agency call history persistence and API exposure
- [x] Demo page call history rendering (no functionality loss)
- [x] Claude Code invocation reliability improvements
- [x] Logging + error persistence for post-call failures

## Progress Log
- 2026-01-15: Initialized tracking file and scope checklist.
- 2026-01-15: Added agency call history helper (`lib/agency-calls.ts`).
- 2026-01-15: Added post-call job queue + worker scaffolding (`lib/postcall-queue.ts`).
- 2026-01-15: Added agency calls API route (`app/api/agency-calls/route.ts`).
- 2026-01-15: Personalization webhook now returns `context_id` for deterministic matching.
- 2026-01-15: Call-complete webhook now uses context_id + fallbacks and enqueues post-call jobs.
- 2026-01-15: Demo page generation prompt updated to render recent call history.
- 2026-01-15: Demo page builder skill updated with Recent Calls section + API fetch.
- 2026-01-15: Claude Code helper now respects provided working directory.
- 2026-01-15: Call-status endpoint now nudges post-call job processing.
- 2026-01-15: Post-call worker now updates agency call history with caller name and summary.
- 2026-01-15: Call-complete payload typing expanded for context_id and demo_page_url.
- 2026-01-15: Post-call prompt now preserves existing call fields when updating JSON.
- 2026-01-15: Scope checklist marked complete for refactor implementation.
- 2026-01-15: `npm run build` completed successfully after refactor changes.
- 2026-01-15: Verified `/api/agency-calls` responds with empty list for `test-agency`.
- 2026-01-15: Archived demo page to force regeneration (`public/demo/ray-white-surry-hills.html.bak`).
- 2026-01-15: Attempted demo regeneration via `/api/generate-demo` (hung; process terminated to continue).
- 2026-01-15: Restored demo HTML from backup for manual augmentation.
- 2026-01-15: Injected Recent Calls section + loader into `public/demo/ray-white-surry-hills.html`.
- 2026-01-15: Registered call context for Ray White Surry Hills (`ctx-1768492982972-f97scp3ac`).
- 2026-01-15: Personalization webhook returned dynamic variables with context_id for Ray White Surry Hills.
- 2026-01-15: Call-complete webhook stored call `call-1768493009666-fe33yd` and enqueued post-call job.
- 2026-01-15: Post-call worker now recovers stale `.processing` jobs and times out long runs.
- 2026-01-15: Requeued post-call job for `call-1768493009666-fe33yd` after timeout safeguards.
- 2026-01-15: Post-call HTML generated and call record updated for `call-1768493009666-fe33yd`.
- 2026-01-15: Agency call history updated for Ray White Surry Hills.
- 2026-01-15: Call-status now returns completed page URL for Ray White Surry Hills.
- 2026-01-15: Context `ctx-1768492982972-f97scp3ac` marked completed in pending-calls store.
- 2026-01-15: `npm run build` succeeded after end-to-end flow updates.
- 2026-01-15: `/api/search` returned cached results for Surry Hills (7 agencies).
- 2026-01-15: Post-call HTML includes Surry Hills + $1.2M budget content for call-1768493009666-fe33yd.
- 2026-01-15: `/api/agency-calls` returns 1 call for Ray White Surry Hills (latest call ID verified).
- 2026-01-15: End-to-end local API flow completed: search → register → personalize → call-complete → post-call page → call history.
- 2026-01-15: Post-call job queue cleared after successful processing.
- 2026-01-15: `/api/generate-demo` returns cached demo URL for Ray White Surry Hills.
