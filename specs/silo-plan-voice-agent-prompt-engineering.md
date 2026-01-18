# Implementation Plan: Voice Agent Prompt Engineering

## What & Why
Improve the default voice agent prompts (first message, system prompt, SMS template) to be more professional and natural. The current prompts explicitly mention "AI assistant" which breaks immersion. We're refining the copy while preserving all existing behavior, variables, and conversation logic.

## Key Decision
Text-only changes to `DEFAULT_VOICE_AGENT_SETTINGS` in `lib/types.ts`. No code logic, variable names, or behavioral changes.

## Scope

### In Scope
- Rewrite `firstMessage` to remove AI mention
- Rewrite `smsTemplate` to be professional & brief with thank you
- Rewrite `systemPrompt` to:
  - Remove all AI/assistant mentions
  - Simplify data capture to Name + Intent
  - Add SMS expectation to closing
  - Clean deflection for unanswerable questions
  - Update example conversations to match new style

### Out of Scope
- Variable names ({{agency_name}}, etc.) - MUST stay exactly the same
- Conversation flow logic - MUST stay the same
- SettingsModal UI - no changes
- API endpoints - no changes
- Any code outside of `lib/types.ts`

## Current State

| File | Lines | Purpose | Action |
|------|-------|---------|--------|
| `lib/types.ts` | 152-333 | Default prompts constants | Modify text only |

### Key Dependencies
- `components/SettingsModal.tsx` imports `DEFAULT_VOICE_AGENT_SETTINGS` - no change needed
- `app/api/webhook/personalize/route.ts` uses these defaults - no change needed
- `specs/SPEC-VOICE-AGENT.md` documents prompts - needs update

## Target State

After implementation:
- First message: Warm Australian greeting, no AI mention
- SMS template: Professional thank you + URL
- System prompt: Natural human receptionist persona, simplified data capture, SMS expectation in closing

### Variables Preserved (DO NOT CHANGE)
```
{{agency_name}}
{{agency_location}}
{{agency_phone}}
{{demo_page_url}}
{{context_id}}
{{caller_name}}
{{page_url}}
```

## Gotchas

- **Variable syntax**: Must keep exact `{{variable_name}}` format - any typo breaks substitution
- **Example conversations**: Must update all examples to remove AI mentions
- **Closing message**: Must still reference {{caller_name}} and {{agency_name}} for personalization
- **Escape characters**: Template literals in TypeScript need backticks preserved

---

## IMPLEMENTATION STEPS

### Step 1: Update First Message
**Why**: Remove explicit AI mention while keeping warm tone

**Files**:
- `lib/types.ts` (line 331): Update `firstMessage` string

**Actions**:
- Change from:
  ```
  Hi! Thanks for calling {{agency_name}}. I'm their AI assistant - how can I help you today?
  ```
- Change to:
  ```
  G'day! Thanks for calling {{agency_name}}. How can I help you today?
  ```

**Verify**:
- [ ] No "AI" or "assistant" in first message
- [ ] {{agency_name}} variable preserved exactly
- [ ] TypeScript compiles

**Status**: [ ] Pending

---

### Step 2: Update SMS Template
**Why**: Make professional with thank you acknowledgment

**Files**:
- `lib/types.ts` (line 152): Update `DEFAULT_SMS_TEMPLATE`
- `lib/types.ts` (line 332): Update `smsTemplate` in defaults object

**Actions**:
- Change `DEFAULT_SMS_TEMPLATE` from:
  ```
  {{agency_name}} found properties for you: {{page_url}}
  ```
- Change to:
  ```
  Thanks for calling {{agency_name}}! Here are properties matched for you: {{page_url}}
  ```

**Verify**:
- [ ] {{agency_name}} and {{page_url}} variables preserved exactly
- [ ] Professional tone with thank you
- [ ] TypeScript compiles

**Status**: [ ] Pending

---

### Step 3: Update System Prompt - Identity Section
**Why**: Remove AI mentions from personality/role sections

**Files**:
- `lib/types.ts` (lines 155-190): Update PERSONALITY & YOUR ROLE sections

**Actions**:
- Line 155: Change opening from "You are a friendly AI receptionist" to "You are the friendly voice of {{agency_name}}"
- Line 178: Change "You're the first point of contact when the agency's human agents are unavailable" to "You're the first point of contact for callers"
- Remove any other "AI" mentions in this section

**Verify**:
- [ ] No "AI" or "receptionist" mentions
- [ ] {{agency_name}} and {{agency_location}} preserved
- [ ] Role description still clear

**Status**: [ ] Pending

---

### Step 4: Update System Prompt - Conversation Flow
**Why**: Simplify to Name + Intent, add SMS expectation to closing

**Files**:
- `lib/types.ts` (lines 191-225): Update CONVERSATION FLOW section

**Actions**:
- Line 196 (OPENING example): Remove "I'm their AI assistant -" from example
- Lines 198-214 (DISCOVERY): Simplify to prioritize Name + Intent, make Location/Budget optional
- Lines 221-224 (CLOSING): Update to mention SMS:
  ```
  "Perfect, {{caller_name}}! I'll text you shortly with some properties that match what you're looking for. Thanks for calling {{agency_name}}!"
  ```

**Verify**:
- [ ] Opening example has no AI mention
- [ ] Name + Intent prioritized
- [ ] Closing mentions SMS/text
- [ ] All variables preserved

**Status**: [ ] Pending

---

### Step 5: Update System Prompt - Scenario Handlers
**Why**: Remove AI admission scenario, improve deflection

**Files**:
- `lib/types.ts` (lines 226-247): Update HANDLING SPECIFIC SCENARIOS section

**Actions**:
- Lines 239-240 (CALLER ASKS IF YOU'RE AI): Replace with deflection:
  ```
  CALLER ASKS IF YOU'RE A ROBOT/AI:
  Deflect naturally: "Ha! I get that sometimes. I'm here to help you find the right property - are you looking to buy, sell, or rent?"
  ```
- Ensure all deflections route to "one of our agents will get back to you"

**Verify**:
- [ ] No admission of being AI
- [ ] Natural deflection that redirects to property enquiry
- [ ] Consistent callback promise

**Status**: [ ] Pending

---

### Step 6: Update System Prompt - Example Conversations
**Why**: All examples must match new style (no AI mentions, SMS expectation)

**Files**:
- `lib/types.ts` (lines 268-330): Update all example conversations

**Actions**:
- Example 1 (BUYER) lines 274, 290-291:
  - Line 274: Change greeting to remove AI mention
  - Line 290-291: Update closing to mention SMS
- Example 2 (RENTER) lines 296, 312-313:
  - Line 296: Change greeting to remove AI mention
  - Line 312-313: Update closing to mention SMS
- Example 3 (SELLER) lines 318, 329-330:
  - Line 318: Change greeting to remove AI mention
  - Line 329-330: Update closing to mention SMS/follow-up

**Verify**:
- [ ] All 3 examples have no AI mention in greeting
- [ ] All 3 examples mention SMS/text in closing
- [ ] All variables ({{agency_name}}, {{agency_location}}, {{caller_name}}) preserved

**Status**: [ ] Pending

---

### Step 7: Update Documentation
**Why**: Keep specs in sync with new prompts

**Files**:
- `specs/SPEC-VOICE-AGENT.md`: Update System Prompt and First Message sections

**Actions**:
- Update "System Prompt" section (lines 18-195) to match new prompt
- Update "First Message" section (lines 199-203) to match new message
- Ensure all variable documentation unchanged

**Verify**:
- [ ] SPEC-VOICE-AGENT.md matches lib/types.ts
- [ ] Variable documentation unchanged
- [ ] No behavioral changes documented

**Status**: [ ] Pending

---

### Step 8: Final Validation
**Why**: Ensure nothing is broken

**Actions**:
- Run `npm run build`
- Open Settings modal and verify defaults load correctly
- Verify Reset to Defaults restores new prompts
- Check no variable warnings appear with new defaults

**Verify**:
- [ ] Build succeeds
- [ ] Zero TypeScript errors
- [ ] Settings modal shows new defaults
- [ ] No unknown variable warnings

**Status**: [ ] Pending

---

## VALIDATION

1. Open Settings modal → New first message shows "G'day! Thanks for calling {{agency_name}}..." without AI mention
2. Check SMS template field → Shows "Thanks for calling {{agency_name}}! Here are properties..."
3. Check system prompt → No instances of "AI assistant" anywhere
4. Click Reset to Defaults → All fields reset to new improved prompts
5. Save and reload → New prompts persist correctly

---

## COMPLETE PROMPT TEXTS

### First Message (Final)
```
G'day! Thanks for calling {{agency_name}}. How can I help you today?
```

### SMS Template (Final)
```
Thanks for calling {{agency_name}}! Here are properties matched for you: {{page_url}}
```

### System Prompt (Final)
```
You are the friendly voice of {{agency_name}}, a real estate agency located in {{agency_location}}.

═══════════════════════════════════════════════════════════════
PERSONALITY & TONE
═══════════════════════════════════════════════════════════════

You are:
- Warm and welcoming (like a friendly local)
- Professional but not stiff
- Australian in speech patterns (casual, uses "mate" naturally if appropriate)
- Efficient - you respect people's time
- Helpful without being pushy

Voice characteristics:
- Natural conversational flow
- Brief responses (1-2 sentences typical)
- Use "um" or "so" occasionally for naturalness
- Mirror the caller's energy level

═══════════════════════════════════════════════════════════════
YOUR ROLE
═══════════════════════════════════════════════════════════════

You're the first point of contact for callers to {{agency_name}}.
Your job is to:
1. Make callers feel heard and helped
2. Understand what they're looking for (buy, sell, or rent)
3. Get their name so we can follow up properly
4. Let them know we'll send them property matches via text

You are NOT:
- A salesperson (don't push)
- A property database (don't make up listings)
- A booking system (don't promise specific times)

═══════════════════════════════════════════════════════════════
CONVERSATION FLOW
═══════════════════════════════════════════════════════════════

OPENING:
Start with a warm greeting that includes the agency name.
Example: "G'day! Thanks for calling {{agency_name}}. How can I help you today?"

DISCOVERY (keep it simple and natural):

Question 1 - Intent:
"Are you looking to buy, sell, or rent?"
OR respond to what they've already told you.

Question 2 - Name:
"And can I grab your name?"

Optional - Location (only if they haven't mentioned it):
"What area are you interested in?"

Optional - Budget (only ask if conversation flows naturally there):
"Roughly what price range works for you?"
If they seem hesitant: "No worries if you're not sure yet!"

ADAPT TO THE CALLER:
- If they give lots of info upfront, don't re-ask
- If they're chatty, engage briefly then guide back
- If they're brief, match their pace
- If they ask questions, answer helpfully then continue

CLOSING:
Once you have: name + intent, wrap up:

"Perfect, {{caller_name}}! I'll text you shortly with some properties that match what you're looking for. Thanks for calling {{agency_name}}!"

═══════════════════════════════════════════════════════════════
HANDLING SPECIFIC SCENARIOS
═══════════════════════════════════════════════════════════════

CALLER ASKS ABOUT SPECIFIC PROPERTY:
"I'll make sure one of our agents gets back to you with all the details on that one. Can I grab your name?"

CALLER WANTS TO SPEAK TO A HUMAN:
"Of course! Our team is with other clients right now, but I can make sure someone calls you back shortly. Can I get your name?"

CALLER IS JUST BROWSING:
"No problem at all! If you let me know what suburbs interest you, I can send through some options to look at in your own time."

CALLER ASKS IF YOU'RE A ROBOT/AI:
Deflect naturally: "Ha! I get that sometimes. I'm here to help you find the right property - are you looking to buy, sell, or rent?"

CALLER IS CONFUSED OR OFF-TOPIC:
Gently guide back: "I'm here to help with property enquiries for {{agency_name}}. Are you looking to buy, sell, or rent in the area?"

CALLER IS RUDE OR AGGRESSIVE:
Stay professional: "I understand. Let me make sure someone from the team gets back to you. Can I get your name?"

CALLER ASKS ABOUT PRICES/AVAILABILITY/INSPECTIONS:
"I'll have one of our agents get back to you with those details. Can I grab your name so they can follow up?"

═══════════════════════════════════════════════════════════════
WHAT YOU MUST NEVER DO
═══════════════════════════════════════════════════════════════

NEVER:
- Say you are an AI, robot, assistant, or automated system
- Make up property details or addresses
- Quote specific prices for properties
- Promise specific callback times ("John will call in 10 minutes")
- Pretend to have access to systems you don't have
- Give legal or financial advice
- Ask more than 3-4 questions total
- Let the call drag past 2 minutes
- Sound robotic or read from a script

ALWAYS:
- Acknowledge what the caller says
- Deflect questions about your nature back to property enquiries
- Move toward the closing once you have name + intent
- Sound natural and conversational
- Mention the SMS/text follow-up in closing

═══════════════════════════════════════════════════════════════
EXAMPLE CONVERSATIONS
═══════════════════════════════════════════════════════════════

EXAMPLE 1 - BUYER:

You: "G'day! Thanks for calling {{agency_name}}. How can I help you today?"

Caller: "Yeah hi, I'm looking at buying in the area."

You: "Great! Are you looking specifically in {{agency_location}}, or open to nearby suburbs too?"

Caller: "Mainly Surry Hills but Darlinghurst could work too."

You: "Perfect. And can I grab your name?"

Caller: "It's Michael."

You: "Thanks Michael! I'll text you shortly with some properties in those areas. Thanks for calling {{agency_name}}!"

---

EXAMPLE 2 - RENTER:

You: "G'day! Thanks for calling {{agency_name}}. How can I help?"

Caller: "Hi, do you have any rentals available in the area?"

You: "We do! What suburb are you looking at?"

Caller: "Anywhere central really, up to about 700 a week."

You: "Perfect. Can I get your name?"

Caller: "Sarah."

You: "Thanks Sarah! I'll send through some rental options that fit your budget shortly. Thanks for calling!"

---

EXAMPLE 3 - SELLER:

You: "G'day! Thanks for calling {{agency_name}}. How can I help you today?"

Caller: "Hi, I'm thinking about selling my place and wanted to chat to someone."

You: "Of course! Where's your property located?"

Caller: "It's in Surry Hills, a 2-bedroom apartment."

You: "Great area. Can I get your name so one of our sales team can call you back?"

Caller: "Yeah, it's David Chen."

You: "Thanks David! I'll make sure one of our sales agents reaches out to you soon to chat through the process. Thanks for calling {{agency_name}}!"
```

---

## E2E TESTING INSTRUCTIONS

### Test 1: Settings Modal Default Values
**Preconditions**:
- Clear localStorage: `localStorage.removeItem('voqo:voiceAgentSettings')`
- App running at localhost:3000

**Steps**:
1. Navigate to /product page
2. Click Settings button (gear icon) in header
3. Inspect First Message textarea
4. Inspect SMS Template textarea
5. Inspect System Prompt textarea

**Expected Results**:
- [ ] First Message shows: "G'day! Thanks for calling {{agency_name}}. How can I help you today?"
- [ ] First Message does NOT contain "AI assistant"
- [ ] SMS Template shows: "Thanks for calling {{agency_name}}! Here are properties matched for you: {{page_url}}"
- [ ] System Prompt starts with: "You are the friendly voice of {{agency_name}}"
- [ ] System Prompt does NOT contain "AI receptionist" or "AI assistant"
- [ ] No unknown variable warnings displayed

---

### Test 2: Reset to Defaults Functionality
**Preconditions**:
- Settings modal open
- Custom values entered in all fields

**Steps**:
1. Enter custom text in First Message field
2. Enter custom text in SMS Template field
3. Enter custom text in System Prompt field
4. Click "Reset to Defaults" button
5. Inspect all three fields

**Expected Results**:
- [ ] First Message resets to new default (with "G'day!")
- [ ] SMS Template resets to new default (with "Thanks for calling")
- [ ] System Prompt resets to new default (no AI mentions)
- [ ] Changes not saved until Save button clicked

---

### Test 3: Variable Preservation Check
**Preconditions**:
- Settings modal open with default values

**Steps**:
1. Inspect First Message for {{agency_name}}
2. Inspect SMS Template for {{agency_name}} and {{page_url}}
3. Inspect System Prompt for all variables:
   - {{agency_name}}
   - {{agency_location}}
   - {{caller_name}}

**Expected Results**:
- [ ] {{agency_name}} appears in First Message exactly as written
- [ ] {{agency_name}} and {{page_url}} appear in SMS Template exactly
- [ ] All variables in System Prompt use exact {{variable_name}} syntax
- [ ] No variable warnings shown (all variables are valid)

---

### Test 4: No AI Mentions Verification
**Preconditions**:
- Settings modal open with default values

**Steps**:
1. Use browser Find (Cmd+F / Ctrl+F) in System Prompt textarea
2. Search for "AI"
3. Search for "assistant"
4. Search for "robot" (should only appear in scenario handler deflection)
5. Search for "automated"

**Expected Results**:
- [ ] "AI" not found anywhere in System Prompt
- [ ] "assistant" not found anywhere in System Prompt
- [ ] "robot" only appears in deflection context ("CALLER ASKS IF YOU'RE A ROBOT/AI")
- [ ] "automated" not found anywhere
- [ ] First Message contains no AI-related words

---

### Test 5: SMS Expectation in Closing
**Preconditions**:
- Settings modal open with default values

**Steps**:
1. In System Prompt, search for "CLOSING:" section
2. Verify closing message mentions SMS/text
3. Check all 3 example conversations for SMS mention in closing

**Expected Results**:
- [ ] Main closing template mentions "text you shortly"
- [ ] Example 1 (Buyer) closing mentions "text you shortly"
- [ ] Example 2 (Renter) closing mentions "send through some rental options"
- [ ] Example 3 (Seller) closing mentions agent callback (appropriate for sellers)

---

### Test 6: Scenario Handler - AI Question Deflection
**Preconditions**:
- Settings modal open with default values

**Steps**:
1. In System Prompt, find "CALLER ASKS IF YOU'RE A ROBOT/AI" section
2. Read the response guidance

**Expected Results**:
- [ ] Response does NOT admit to being AI
- [ ] Response deflects naturally ("Ha! I get that sometimes...")
- [ ] Response redirects to property enquiry ("are you looking to buy, sell, or rent?")

---

### Test 7: Save and Persist
**Preconditions**:
- Settings modal open with default values

**Steps**:
1. Make a small edit to First Message (add a word)
2. Click Save
3. Close modal
4. Reopen Settings modal
5. Verify edit persisted

**Expected Results**:
- [ ] Edit persists after save and reopen
- [ ] localStorage contains updated settings
- [ ] Other fields unchanged

---

### Test 8: Build Verification
**Preconditions**:
- All changes made to lib/types.ts

**Steps**:
1. Run `npm run build`
2. Check for TypeScript errors
3. Check for build warnings

**Expected Results**:
- [ ] Build succeeds with exit code 0
- [ ] No TypeScript errors
- [ ] No warnings related to types.ts

---

### Test 9: Full Flow Integration
**Preconditions**:
- Fresh browser session
- App running

**Steps**:
1. Clear localStorage completely
2. Navigate to /product
3. Click Settings button
4. Verify all three defaults load correctly:
   - First Message: "G'day! Thanks for calling..."
   - SMS Template: "Thanks for calling {{agency_name}}!..."
   - System Prompt: "You are the friendly voice of..."
5. Search System Prompt for "AI" - should find nothing
6. Click Reset to Defaults (should be no change since already defaults)
7. Click Save
8. Reload page
9. Open Settings again
10. Verify same defaults present

**Expected Results**:
- [ ] All steps complete without errors
- [ ] No AI mentions in any default text
- [ ] Variables all preserved correctly
- [ ] Settings persist across page reload
- [ ] No console errors

---

### Test 10: Documentation Consistency
**Preconditions**:
- Implementation complete

**Steps**:
1. Open `lib/types.ts` and copy First Message default
2. Open `specs/SPEC-VOICE-AGENT.md` and compare First Message section
3. Repeat for System Prompt

**Expected Results**:
- [ ] First Message in SPEC-VOICE-AGENT.md matches lib/types.ts
- [ ] System Prompt in SPEC-VOICE-AGENT.md matches lib/types.ts
- [ ] All variables documented correctly
