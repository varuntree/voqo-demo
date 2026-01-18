# Implementation Plan: Configurable SMS Template

## What & Why
Add a configurable SMS message template to the Settings modal, following the same pattern as voice agent settings. Users can customize the SMS sent after post-call page generation, with support for `{{variable}}` placeholders that are substituted at send time. The template flows through the same register-call → pending context → call data → SMS worker pipeline as voice agent settings.

## Key Decision
Store `smsTemplate` alongside `systemPrompt` and `firstMessage` in the existing `VoiceAgentSettings` interface and localStorage key (`voqo:voiceAgentSettings`). Empty template falls back to the default message.

## Scope

### In Scope
- Add `smsTemplate` field to `VoiceAgentSettings` interface
- Add default SMS template constant
- Add SMS template textarea to SettingsModal
- Support same `{{variable}}` placeholders as voice agent
- Flow smsTemplate through register-call → pending context → call data → SMS worker
- Variable substitution at SMS send time
- Fall back to default if template is empty

### Out of Scope
- SMS-specific variables (only use existing voice agent variables)
- Per-agency SMS templates (global config only)
- SMS preview/testing UI
- SMS character limit validation

## Current State

| File | Lines | Purpose | Action |
|------|-------|---------|--------|
| `lib/types.ts` | 136-148 | `VoiceAgentSettings` interface, `AVAILABLE_VARIABLES` | Modify |
| `components/SettingsModal.tsx` | 34-193 | Settings UI with voice agent fields | Modify |
| `public/voqo-demo-call.js` | 13-20, 178-182 | Reads localStorage, includes settings in payload | No change needed |
| `app/api/register-call/route.ts` | 13-19, 85 | Parses settings, stores in context | Modify (add smsTemplate parsing) |
| `app/api/webhook/call-complete/route.ts` | 227-259 | Builds callData from matched context | Modify (preserve smsTemplate) |
| `lib/sms-queue.ts` | 135-148, 222-227 | `canSendSms()` checks, message construction | Modify |

### Key Dependencies
- `public/voqo-demo-call.js:178-182` reads entire settings object from localStorage - no change needed
- `app/api/register-call/route.ts:49` calls `parseVoiceAgentSettings()` - must add smsTemplate
- `app/api/webhook/call-complete/route.ts:242` stores `agencyData` from context - must also preserve settings
- `lib/sms-queue.ts:224` constructs message - must use template with variable substitution

## Target State

- SettingsModal has third textarea for SMS Template
- VoiceAgentSettings includes `smsTemplate: string`
- Default template: `"{{agency_name}} found properties for you: {{page_url}}"`
- SMS worker substitutes variables before sending
- Empty template uses default

### Pattern to Follow
- See `lib/types.ts:150-328` for default voice agent settings pattern
- See `components/SettingsModal.tsx:138-148` for textarea field pattern
- See `app/api/webhook/personalize/route.ts:40-58` for variable substitution pattern

## Gotchas

- **`page_url` variable**: SMS needs `{{page_url}}` but voice agent uses `{{demo_page_url}}` - add `page_url` as new SMS-specific variable
- **Settings preservation**: Must flow settings from pending context → callData → SMS worker. Currently only agencyData is preserved.
- **Variable substitution**: Must happen in SMS worker since `page_url` isn't known until page is generated
- **Fallback behavior**: Empty string or whitespace-only template must use default, not send empty SMS

---

## IMPLEMENTATION STEPS

### Step 1: Update VoiceAgentSettings Interface
**Why**: Add smsTemplate field and default value to type system

**Files**:
- `lib/types.ts` (lines 136-148): Add smsTemplate to interface
- `lib/types.ts` (lines 141-148): Add `{{page_url}}` to AVAILABLE_VARIABLES
- `lib/types.ts` (after line 328): Add DEFAULT_SMS_TEMPLATE constant

**Actions**:
- Add `smsTemplate: string;` to VoiceAgentSettings interface (line 138, after firstMessage)
- Add `'{{page_url}}'` to AVAILABLE_VARIABLES array (after `{{caller_name}}`)
- Add constant: `export const DEFAULT_SMS_TEMPLATE = '{{agency_name}} found properties for you: {{page_url}}';`
- Update DEFAULT_VOICE_AGENT_SETTINGS to include `smsTemplate: DEFAULT_SMS_TEMPLATE`

**Verify**:
- [x] `npm run build` succeeds
- [x] TypeScript shows smsTemplate as required field on VoiceAgentSettings

**Status**: [✓] Complete

---

### Step 2: Update SettingsModal UI
**Why**: Add SMS template textarea to settings modal

**Files**:
- `components/SettingsModal.tsx` (lines 34-193): Add state, load/save, UI for smsTemplate

**Actions**:
- Import `DEFAULT_SMS_TEMPLATE` from `@/lib/types`
- Add state: `const [smsTemplate, setSmsTemplate] = useState(DEFAULT_SMS_TEMPLATE);`
- Update `findUnknownVariables` to include smsTemplate in check
- Update localStorage load: add `setSmsTemplate(parsed.smsTemplate ?? DEFAULT_SMS_TEMPLATE);`
- Update handleSave: include smsTemplate in settings object
- Update handleReset: add `setSmsTemplate(DEFAULT_SMS_TEMPLATE);`
- Add new textarea section between First Message and System Prompt

**Verify**:
- [x] Settings modal shows SMS Template textarea
- [x] Saving persists to localStorage
- [x] Reset restores default
- [x] Unknown variable warning detects bad SMS template vars

**Status**: [✓] Complete

---

### Step 3: Update register-call Settings Parsing
**Why**: Ensure smsTemplate is parsed and stored in pending context

**Files**:
- `app/api/register-call/route.ts` (lines 13-19): Update parseVoiceAgentSettings

**Actions**:
- Update parseVoiceAgentSettings to accept optional smsTemplate with backwards compatibility

**Verify**:
- [x] POST /api/register-call with settings.smsTemplate stores it in pending-calls.json
- [x] Backwards compatible: old payloads without smsTemplate still work

**Status**: [✓] Complete

---

### Step 4: Preserve Settings in Call Data
**Why**: Pass settings from pending context through to call JSON so SMS worker can access it

**Files**:
- `app/api/webhook/call-complete/route.ts` (lines 227-259): Add settings to callData
- `app/api/webhook/call-complete/route.ts` (line 69-86): Update PendingCallContext interface

**Actions**:
- Add settings to PendingCallContext interface
- Add settings to callData object
- Update the merge logic to preserve settings

**Verify**:
- [x] After call-complete webhook, call JSON contains settings.smsTemplate
- [x] Existing calls without settings still work

**Status**: [✓] Complete

---

### Step 5: Implement SMS Template Substitution
**Why**: Use custom template with variable substitution when sending SMS

**Files**:
- `lib/sms-queue.ts` (lines 135-148, 222-227): Update canSendSms and message construction

**Actions**:
- Import DEFAULT_SMS_TEMPLATE
- Update `canSendSms` return type to include smsTemplate, callerName, agencyLocation
- Add substituteSmsVariables function for template variable replacement
- Update message construction to use template with variable substitution

**Verify**:
- [x] Custom SMS template is used when set
- [x] Variables are substituted correctly
- [x] Empty template falls back to default
- [x] Backwards compatible: calls without settings use default

**Status**: [✓] Complete

---

### Step 6: Update Documentation
**Why**: Keep specs in sync with implementation

**Files**:
- `specs/SPEC-DATA-API.md`: Update VoiceAgentSettings schema
- `specs/SPEC-VOICE-AGENT.md`: Document SMS template feature

**Actions**:
- Update VoiceAgentSettings interface in SPEC-DATA-API.md
- Update SMS Notification section with configurable template docs
- Add SMS Template Customization section to SPEC-VOICE-AGENT.md

**Verify**:
- [x] VoiceAgentSettings schema updated in SPEC-DATA-API.md
- [x] SMS template documented in SPEC-VOICE-AGENT.md

**Status**: [✓] Complete

---

### Step 7: Final Validation
**Why**: Ensure nothing is broken

**Actions**:
- Run `npm run build`
- Test settings modal loads/saves smsTemplate
- Verify localStorage contains smsTemplate
- Check TypeScript compilation has no errors

**Verify**:
- [x] Build succeeds
- [x] Zero TypeScript errors
- [x] Settings modal works correctly

**Status**: [✓] Complete

---

## VALIDATION

1. Open Settings modal → SMS Template textarea visible with default value
2. Edit SMS template → Save → Reopen modal → Custom template persists
3. Reset to Defaults → SMS template resets to default
4. Make demo call → SMS uses custom template with variables substituted
5. Clear localStorage → SMS falls back to default template

---

## E2E TESTING INSTRUCTIONS

### Test 1: Settings Modal SMS Template Field
**Preconditions**:
- App running at localhost:3000
- Clear localStorage: `localStorage.removeItem('voqo:voiceAgentSettings')`

**Steps**:
1. Navigate to main page
2. Click gear icon in header to open Settings modal
3. Verify SMS Template textarea is visible between First Message and System Prompt
4. Verify default value is `{{agency_name}} found properties for you: {{page_url}}`

**Expected Results**:
- [✓] SMS Template textarea visible
- [✓] Default template value shown
- [✓] Helper text "Sent to caller after their personalized page is ready" visible

---

### Test 2: SMS Template Save/Load
**Preconditions**:
- Settings modal open

**Steps**:
1. Edit SMS Template to: `Hi {{caller_name}}! Check your listings: {{page_url}}`
2. Click Save
3. Close and reopen modal
4. Verify custom template persists

**Expected Results**:
- [✓] Custom SMS template persists after save
- [✓] localStorage contains `voqo:voiceAgentSettings` with smsTemplate field

---

### Test 3: SMS Template Reset
**Preconditions**:
- Custom SMS template saved

**Steps**:
1. Open Settings modal
2. Click "Reset to Defaults"
3. Verify SMS Template resets to default value

**Expected Results**:
- [✓] SMS Template resets to `{{agency_name}} found properties for you: {{page_url}}`

---

### Test 4: Unknown Variable Warning
**Preconditions**:
- Settings modal open

**Steps**:
1. Edit SMS Template to include `{{unknown_var}}`
2. Verify warning appears for unknown variable

**Expected Results**:
- [✓] Warning shows "Unknown variable(s) detected: {{unknown_var}}"

---

### Test 5: Settings Flow to Register-Call API
**Preconditions**:
- Custom SMS template saved in localStorage
- Demo page available
- Browser DevTools Network tab open

**Steps**:
1. Navigate to a demo page
2. Click "Call Demo" button
3. Inspect POST request to /api/register-call
4. Verify settings.smsTemplate in request body

**Expected Results**:
- [✓] Request body contains settings.smsTemplate with custom value

---

### Test 6: Backwards Compatibility
**Preconditions**:
- Old localStorage format without smsTemplate

**Steps**:
1. Set localStorage manually: `localStorage.setItem('voqo:voiceAgentSettings', JSON.stringify({systemPrompt: "test", firstMessage: "test"}))`
2. Open Settings modal
3. Verify SMS Template defaults properly

**Expected Results**:
- [✓] SMS Template shows default value when missing from localStorage
- [✓] No errors in console
