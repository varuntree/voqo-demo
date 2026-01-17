# Implementation Plan: Voice Agent Settings Modal

## What & Why

Add a Settings button to the header navigation that opens a modal where users can customize the ElevenLabs voice agent configuration. This allows real-time customization of the system prompt and first message used during demo calls, with dynamic variable substitution (e.g., `{{agency_name}}`). Settings persist in localStorage and are applied via the personalization webhook.

## Key Decision

Store settings client-side in localStorage and pass them to the server via the `/api/register-call` endpoint. The personalization webhook reads these settings from the call context and returns `conversation_config_override` to ElevenLabs.

## Scope

### In Scope
- Settings button in header navigation (gear icon)
- Modal dialog with two textarea fields: System Prompt, First Message
- Variable reference panel showing available `{{variables}}`
- Validation for required fields and unknown variables
- Reset to Defaults button
- localStorage persistence
- Passing settings through register-call → personalize webhook chain

### Out of Scope
- Voice selection (voice_id override)
- Language selection
- LLM model selection
- Server-side settings storage
- Per-agency settings (all agencies use same settings)

## Current State

### Personalization Webhook
| File | Lines | Purpose | Action |
|------|-------|---------|--------|
| `app/api/webhook/personalize/route.ts` | 1-205 | Returns `dynamic_variables` + `conversation_config_override` | Modify |

Currently only overrides `first_message` (lines 172-179). System prompt comes from ElevenLabs agent config.

### Register Call Endpoint
| File | Lines | Purpose | Action |
|------|-------|---------|--------|
| `app/api/register-call/route.ts` | all | Stores call context before dial | Modify |

Needs to accept and store custom prompt settings.

### Header Navigation
| File | Lines | Purpose | Action |
|------|-------|---------|--------|
| `app/page.tsx` | 571-589 | Header with TabNavigation | Modify |
| `components/TabNavigation.tsx` | all | Tab buttons | No change |

### Key Dependencies
- `lib/types.ts` - TypeScript interfaces
- `data/context/pending-calls.json` - Call context storage
- ElevenLabs webhook contract: `conversation_config_override.agent.prompt.prompt`, `conversation_config_override.agent.first_message`

## Target State

### Data Flow
```
Settings Modal → localStorage
     ↓
User clicks "Call Demo" on demo page
     ↓
voqo-demo-call.js reads localStorage, includes in /api/register-call
     ↓
Server stores in pending-calls.json with agencyData + settings
     ↓
ElevenLabs calls /api/webhook/personalize
     ↓
Webhook returns conversation_config_override with custom prompts
     ↓
Voice agent uses custom system prompt + first message
```

### Pattern to Follow
- Modal: See `components/CallDetailModal.tsx:167-282` for overlay + content structure
- Form fields: See `app/page.tsx:606-612` for input styling
- localStorage: See `app/page.tsx:66-80` for persist/clear pattern

## Gotchas

- **Variable substitution**: Must replace `{{agency_name}}` etc. with actual values before sending to ElevenLabs. The webhook does this substitution at call time.
- **localStorage security**: Settings are stored in browser, so demo pages on same origin can read them. This is acceptable for demo purposes.
- **Large prompts**: ElevenLabs has token limits. Don't validate length, but document the risk.
- **Newlines in JSON**: Prompts with newlines must be properly escaped when stored/transmitted.
- **Demo page script**: `public/voqo-demo-call.js` runs on generated HTML pages. Must be updated to read and send settings.

---

## IMPLEMENTATION STEPS

### Step 1: Define Settings Interface and Defaults
**Why**: Establish the data contract for settings storage and validation.

**Files**:
- `lib/types.ts` (end of file): Add new interface

**Actions**:
- Add `VoiceAgentSettings` interface with `systemPrompt`, `firstMessage` fields
- Add `DEFAULT_VOICE_AGENT_SETTINGS` constant with values from `specs/SPEC-VOICE-AGENT.md`
- Add `AVAILABLE_VARIABLES` constant listing all supported placeholders

**Verify**:
- [x] TypeScript compiles without errors
- [x] Interface exported from lib/types.ts

**Status**: [✓] Complete

---

### Step 2: Create SettingsModal Component
**Why**: Provide UI for editing voice agent settings.

**Files**:
- `components/SettingsModal.tsx` (new file): Create modal component

**Actions**:
- Create modal with overlay (follow CallDetailModal pattern)
- Add two textarea fields: System Prompt, First Message
- Add variable reference section showing available `{{variables}}`
- Add Reset to Defaults button
- Add Save and Cancel buttons
- Validate: warn if unknown `{{variable}}` patterns found
- On save: store to localStorage key `voqo:voiceAgentSettings`
- On mount: load from localStorage or use defaults

**Verify**:
- [x] Modal renders without errors
- [x] Save persists to localStorage
- [x] Reset restores default values
- [x] Unknown variable warning appears

**Status**: [✓] Complete

---

### Step 3: Add Settings Button to Header
**Why**: Provide entry point to settings modal.

**Files**:
- `app/page.tsx` (lines 571-589): Add settings button and modal state

**Actions**:
- Add `settingsOpen` state (boolean)
- Add gear icon button between TabNavigation and "New Search" button
- Render `<SettingsModal>` when `settingsOpen` is true
- Pass `onClose={() => setSettingsOpen(false)}` to modal

**Verify**:
- [x] Gear icon visible in header
- [x] Clicking gear opens modal
- [x] Closing modal hides it

**Status**: [✓] Complete

---

### Step 4: Update Demo Page Script to Include Settings
**Why**: Pass custom settings from main app to generated demo pages.

**Files**:
- `public/voqo-demo-call.js` (all): Update to read and send settings

**Actions**:
- Read `voqo:voiceAgentSettings` from localStorage
- Include settings object in `/api/register-call` POST body
- Handle case where settings are null/undefined (use server defaults)

**Verify**:
- [x] Demo page call button sends settings to register-call
- [x] Network tab shows settings in request body

**Status**: [✓] Complete

---

### Step 5: Update Register-Call to Accept Settings
**Why**: Store custom settings in call context for webhook to retrieve.

**Files**:
- `app/api/register-call/route.ts` (all): Accept and store settings

**Actions**:
- Parse optional `settings` field from request body
- Store `settings` alongside `agencyData` in pending-calls.json context
- Type the settings field using `VoiceAgentSettings | null`

**Verify**:
- [x] API accepts settings in request body
- [x] Settings stored in pending-calls.json

**Status**: [✓] Complete

---

### Step 6: Update Personalize Webhook to Use Custom Settings
**Why**: Return custom prompts to ElevenLabs based on stored settings.

**Files**:
- `app/api/webhook/personalize/route.ts` (lines 141-180): Apply settings

**Actions**:
- Read `settings` from matched context
- If settings exist, build `conversation_config_override` with:
  - `agent.prompt.prompt`: substitute variables in `settings.systemPrompt`
  - `agent.first_message`: substitute variables in `settings.firstMessage`
- If no custom settings, keep current behavior (only first_message override)
- Create `substituteVariables(template, vars)` helper function

**Verify**:
- [x] Webhook returns custom system prompt when settings provided
- [x] Webhook returns custom first message when settings provided
- [x] Variables like `{{agency_name}}` are substituted correctly

**Status**: [✓] Complete

---

### Step 7: Update Documentation
**Why**: Keep specs in sync with implementation.

**Files**:
- `specs/SPEC-DATA-API.md`: Add settings to register-call
- `specs/SPEC-VOICE-AGENT.md`: Document customization options
- `specs/SPEC-ARCHITECTURE.md`: Update data flow diagram

**Actions**:
- Add `settings?: VoiceAgentSettings` to register-call request schema
- Add `settings` field to pending call context schema
- Document conversation_config_override structure
- Add note about localStorage persistence

**Verify**:
- [x] All new APIs documented
- [x] All new data schemas documented
- [x] Architecture changes reflected in specs

**Status**: [✓] Complete

---

### Step 8: Final Validation
**Why**: Ensure nothing is broken.

**Actions**:
- Run `npm run build`
- Test affected API routes with curl
- Verify file storage works in /data/

**Verify**:
- [x] Build succeeds
- [x] Zero TypeScript errors
- [x] API routes return valid responses

**Status**: [✓] Complete

---

## VALIDATION

1. Open main page → Click gear icon → Modal opens with default prompts
2. Edit system prompt → Add custom text → Save → Reload page → Custom text persists
3. Click Reset to Defaults → Fields revert to spec values
4. Navigate to demo page → Click call button → Check network tab → Settings included in register-call
5. Dial demo number → Agent uses custom greeting (verify via transcript)

---

## E2E TESTING INSTRUCTIONS

### Test 1: Modal Open/Close Behavior
**Preconditions**:
- App running at localhost:3000
- No prior settings in localStorage

**Steps**:
1. Navigate to main page
2. Click gear icon in header
3. Press Escape key
4. Click gear icon again
5. Click outside modal overlay
6. Click gear icon again
7. Click Cancel button
8. Click gear icon again
9. Click Save button

**Expected Results**:
- [ ] Gear icon visible in header next to tabs
- [ ] Modal opens on gear click with overlay backdrop
- [ ] Escape key closes modal
- [ ] Clicking overlay closes modal
- [ ] Cancel button closes modal without saving
- [ ] Save button closes modal and persists values
- [ ] No console errors during open/close cycles

---

### Test 2: Default Values Loading
**Preconditions**:
- Clear localStorage: `localStorage.removeItem('voqo:voiceAgentSettings')`
- Refresh page

**Steps**:
1. Click gear icon to open modal
2. Inspect System Prompt textarea value
3. Inspect First Message textarea value

**Expected Results**:
- [ ] System Prompt contains default from SPEC-VOICE-AGENT.md
- [ ] First Message contains default greeting with `{{agency_name}}` variable
- [ ] Variable reference panel shows all available variables
- [ ] No validation warnings on default values

---

### Test 3: Editing and Saving Settings
**Preconditions**:
- Modal open with default values

**Steps**:
1. Clear System Prompt textarea
2. Enter: "You are a sales assistant for {{agency_name}} in {{agency_location}}."
3. Clear First Message textarea
4. Enter: "Hello! I'm calling from {{agency_name}}. How can I help today?"
5. Click Save
6. Reopen modal

**Expected Results**:
- [ ] Textareas accept input without lag
- [ ] No validation errors for valid {{variables}}
- [ ] Modal closes on Save
- [ ] Reopened modal shows saved custom values
- [ ] localStorage contains `voqo:voiceAgentSettings` key

---

### Test 4: localStorage Persistence Across Page Reload
**Preconditions**:
- Custom settings saved from Test 3

**Steps**:
1. Close modal
2. Hard refresh page (Cmd+Shift+R / Ctrl+Shift+R)
3. Click gear icon to open modal
4. Check textarea values

**Expected Results**:
- [ ] Custom System Prompt persists after reload
- [ ] Custom First Message persists after reload
- [ ] No flash of default values before custom values load

---

### Test 5: Reset to Defaults Functionality
**Preconditions**:
- Custom settings saved in localStorage

**Steps**:
1. Open settings modal
2. Verify custom values present
3. Click "Reset to Defaults" button
4. Inspect textarea values
5. Click Save
6. Reopen modal

**Expected Results**:
- [ ] Reset button resets both fields to spec defaults
- [ ] Reset does NOT auto-save (must click Save)
- [ ] After save, localStorage reflects default values
- [ ] Confirmation or immediate visual feedback on reset

---

### Test 6: Variable Substitution Warnings
**Preconditions**:
- Modal open

**Steps**:
1. Enter in System Prompt: "Hello {{unknown_var}} and {{agency_name}}"
2. Enter in First Message: "Testing {{invalid}} placeholder"
3. Observe validation warnings

**Expected Results**:
- [ ] Warning appears for `{{unknown_var}}`
- [ ] Warning appears for `{{invalid}}`
- [ ] No warning for `{{agency_name}}` (valid variable)
- [ ] Save still allowed (warning, not blocking error)
- [ ] Warning lists unrecognized variable names

---

### Test 7: Settings Flow Through register-call API
**Preconditions**:
- Custom settings saved in localStorage
- Demo page generated for test agency
- Browser DevTools Network tab open

**Steps**:
1. Navigate to a generated demo page (e.g., /demo/test-agency.html)
2. Click "Call Demo" button
3. Inspect POST request to /api/register-call in Network tab
4. Examine request body JSON

**Expected Results**:
- [ ] Request body contains `settings` field
- [ ] `settings.systemPrompt` matches localStorage value
- [ ] `settings.firstMessage` matches localStorage value
- [ ] Request succeeds with 200 status

---

### Test 8: Settings Flow Through personalize Webhook
**Preconditions**:
- Custom settings registered via Test 7
- Ability to inspect webhook response (curl or logs)

**Steps**:
1. Trigger personalize webhook manually:
```bash
curl -X POST http://localhost:3000/api/webhook/personalize \
  -H "Content-Type: application/json" \
  -d '{"conversation_id":"test-123","agent_id":"agent-xyz"}'
```
2. Inspect response JSON

**Expected Results**:
- [ ] Response contains `conversation_config_override`
- [ ] `conversation_config_override.agent.prompt.prompt` = substituted system prompt
- [ ] `conversation_config_override.agent.first_message` = substituted first message
- [ ] Variables replaced with actual agency data (not raw `{{agency_name}}`)

---

### Test 9: Full End-to-End Call with Custom Prompts
**Preconditions**:
- ElevenLabs agent configured and active
- Custom settings: First Message = "Greetings from {{agency_name}}! This is a custom test."

**Steps**:
1. Save custom settings with distinctive greeting
2. Navigate to demo page
3. Click call button to initiate call
4. Answer phone when it rings
5. Listen to agent's first message
6. End call
7. Check call transcript/logs

**Expected Results**:
- [ ] Agent speaks custom first message (not default)
- [ ] Variable `{{agency_name}}` replaced with actual agency name
- [ ] System prompt influences agent behavior (test with specific instruction)
- [ ] Call transcript shows custom greeting

---

### Test 10: Edge Cases
**Preconditions**:
- Modal open

**Subtest 10a: Empty Fields**
**Steps**:
1. Clear both textareas completely
2. Click Save

**Expected Results**:
- [ ] Validation error prevents save with empty System Prompt
- [ ] Validation error prevents save with empty First Message
- [ ] Error message indicates which field(s) are required

**Subtest 10b: Special Characters**
**Steps**:
1. Enter System Prompt with: `"Test with 'quotes', "double", <html>, & ampersand, \n newline`
2. Enter First Message with: `Japanese: こんにちは, Emoji: 👋, Math: 2+2=4`
3. Save and reload

**Expected Results**:
- [ ] Special characters preserved correctly
- [ ] Quotes and HTML entities not corrupted
- [ ] Unicode characters (Japanese, emoji) intact
- [ ] Newlines preserved in stored value

**Subtest 10c: Very Long Prompts**
**Steps**:
1. Enter 5000+ character System Prompt
2. Enter 1000+ character First Message
3. Save settings
4. Trigger call flow

**Expected Results**:
- [ ] Long prompts saved to localStorage without truncation
- [ ] UI remains responsive (no freeze)
- [ ] Scroll appears in textarea for overflow
- [ ] API handles large payload (or returns meaningful error if limit exceeded)

**Subtest 10d: Malformed Variables**
**Steps**:
1. Enter: `{{agency_name} {{}} {{ }} {agency_name}`
2. Check validation warnings

**Expected Results**:
- [ ] `{{agency_name}` (missing brace) - no match, no warning
- [ ] `{{}}` - empty variable, warning displayed
- [ ] `{{ }}` - whitespace variable, warning displayed
- [ ] `{agency_name}` - single braces, no match, no warning
- [ ] Only properly formed `{{var}}` patterns validated

---

### Test 11: Concurrent Tab Behavior
**Preconditions**:
- App open in two browser tabs

**Steps**:
1. Tab A: Open settings, enter custom prompt
2. Tab A: Save settings
3. Tab B: Open settings modal
4. Check if Tab B shows updated values

**Expected Results**:
- [ ] Tab B shows values from Tab A (localStorage shared)
- [ ] No race conditions on save
- [ ] Consider storage event listener for real-time sync (optional enhancement)

---

### Test 12: Settings Null/Undefined Fallback
**Preconditions**:
- Clear localStorage completely
- Demo page loaded

**Steps**:
1. Remove `voqo:voiceAgentSettings` from localStorage
2. Click call button on demo page
3. Check register-call request body

**Expected Results**:
- [ ] Request proceeds without error
- [ ] `settings` field is null or omitted
- [ ] Webhook uses default prompts when no custom settings provided
- [ ] Call works normally with fallback behavior

