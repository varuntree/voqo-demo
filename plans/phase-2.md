# Phase 2: External Services Setup (Chrome)

## What & Why
Collect real credentials from Twilio and ElevenLabs dashboards. Required before API routes can function.

## Prerequisites
- Phase 1 complete (project structure exists)
- User logged into Twilio and ElevenLabs in Chrome
- Twilio account has payment method (for AU number)
- ElevenLabs Creator/Pro plan (for Conversational AI)

## Execution Context
| Action Type | How to Execute |
|-------------|----------------|
| Chrome | mcp__claude-in-chrome__* tools |
| File edits | Edit tool for .env.local |
| Verification | Screenshots, file reads |

---

## IMPLEMENTATION STEPS

### Step 2.1: Twilio - Get Account SID and Auth Token
**Why**: Core credentials for Twilio API

**Actions**:
- Navigate to https://console.twilio.com
- Locate Account Info panel on dashboard
- Copy Account SID (starts with AC)
- Click reveal on Auth Token, copy value

**Chrome Steps**:
1. `navigate` to https://console.twilio.com
2. `screenshot` to see dashboard layout
3. Look for "Account Info" section
4. Note Account SID (ACxxxxxxxx format)
5. Click "Show" or reveal button for Auth Token
6. Note Auth Token value

**Verify**:
- [x] Account SID copied (32+ chars, starts with AC)
- [x] Auth Token copied (32 chars)

**Status**: [✓] Complete

**Result**:
- Account SID: REDACTED_TWILIO_SID
- Auth Token: REDACTED_TWILIO_TOKEN

---

### Step 2.2: Twilio - Get Australian Phone Number
**Why**: Phone number users will call for demo

**Actions**:
- Navigate to Phone Numbers > Manage > Active Numbers
- Check for existing +61 number
- If none: check regulatory bundle status, purchase number

**Chrome Steps**:
1. Navigate to Phone Numbers > Manage > Active Numbers
2. `screenshot` to see active numbers
3. If +61 number exists:
   - Note number in E.164 format (+61XXXXXXXXX)
   - Skip to Step 2.3
4. If no +61 number:
   - Navigate to Phone Numbers > Manage > Buy a Number
   - Search: Country=Australia, Type=Local
   - Check for regulatory bundle requirement
   - If bundle needed but not approved: STOP, inform user
   - If approved: purchase cheapest Sydney-area number (~$3/mo)
5. Note final number in E.164 format

**Verify**:
- [x] Australian number noted (+61XXXXXXXXX format)
- [x] Number has Voice capability

**Status**: [✓] Complete

**Result**: Existing Australian number found: +61483943567

---

### Step 2.3: ElevenLabs - Get API Key
**Why**: Required for ElevenLabs API calls

**Actions**:
- Navigate to https://elevenlabs.io
- Go to Profile > API Keys
- Copy existing key or create new

**Chrome Steps**:
1. `navigate` to https://elevenlabs.io
2. Click profile/avatar icon
3. Navigate to "API Keys" or "Profile Settings"
4. `screenshot` to see API keys section
5. Copy existing API key, or click "Create new key"
6. Note API key value

**Verify**:
- [x] API key copied (starts with sk_ or similar)

**Status**: [✓] Complete

**Result**: Created new API key: REDACTED_ELEVENLABS_KEY

---

### Step 2.4: Update .env.local with Real Credentials
**Why**: Replace placeholders with actual values

**Actions**:
- Edit .env.local with collected values
- Leave ELEVENLABS_AGENT_ID as "pending" (created in Phase 6)

**File**: `/Users/varunprasad/code/prjs/voqo-demo/.env.local`

**Update**:
```
TWILIO_ACCOUNT_SID=REDACTED_TWILIO_SID
TWILIO_AUTH_TOKEN=REDACTED_TWILIO_TOKEN
TWILIO_PHONE_NUMBER=+61483943567
ELEVENLABS_API_KEY=REDACTED_ELEVENLABS_KEY
ELEVENLABS_AGENT_ID=pending
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_DEMO_PHONE=+61 483 943 567
```

**Verify**:
- [x] TWILIO_ACCOUNT_SID starts with AC
- [x] TWILIO_AUTH_TOKEN is 32 chars
- [x] TWILIO_PHONE_NUMBER is E.164 format
- [x] ELEVENLABS_API_KEY is set
- [x] NEXT_PUBLIC_DEMO_PHONE is human-readable format

**Status**: [✓] Complete

---

### Step 2.5: Phase Checkpoint
**Why**: Confirm Phase 2 complete before Phase 3

**Verify**:
- [x] Twilio Account SID noted
- [x] Twilio Auth Token noted
- [x] Australian phone number acquired (+61)
- [x] ElevenLabs API key noted
- [x] .env.local updated with real values

**Status**: [✓] Complete

---

## VALIDATION

1. Read .env.local → All Twilio values are real (not "placeholder") ✓
2. TWILIO_ACCOUNT_SID → Starts with "AC" ✓
3. TWILIO_PHONE_NUMBER → Starts with "+61" ✓
4. ELEVENLABS_API_KEY → Not "placeholder" ✓
5. ELEVENLABS_AGENT_ID → Shows "pending" (expected - created Phase 6) ✓

## Notes

- Regulatory bundle for AU numbers can take 1-3 business days if not pre-approved
- If bundle pending, Phase 2 blocked until approved
- ElevenLabs Agent ID created later in Phase 6 (voice agent setup)
- Do NOT configure Twilio webhooks manually - ElevenLabs does this when importing number
