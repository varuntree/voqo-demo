# Phase 6: ElevenLabs Agent Setup (Chrome)

## What & Why
Create and configure the ElevenLabs Conversational AI voice agent that handles inbound calls. This connects Twilio phone number to AI agent with webhooks for dynamic agency context injection and post-call processing.

## Prerequisites
- Phases 1-5 complete (project, credentials, skills, API routes, UI)
- Twilio credentials in `.env.local`
- ElevenLabs API key in `.env.local`
- ngrok installed (`npm install -g ngrok` or `brew install ngrok`)

## Execution Context
| Action Type | How to Execute |
|-------------|----------------|
| Local terminal | Bash tool (ngrok) |
| Chrome | mcp__claude-in-chrome__* tools (assume logged in) |
| Verification | Screenshots, curl, phone call test |

---

## IMPLEMENTATION STEPS

### Step 6.1: Start ngrok tunnel
**Why**: ElevenLabs webhooks require HTTPS. ngrok provides secure tunnel to local dev server.

**Actions**:
- Ensure dev server running on port 3000
- Start ngrok: `ngrok http 3000`
- Note HTTPS URL (e.g., `https://abc123.ngrok-free.app`)

**Verify**:
- [ ] ngrok shows "Forwarding" with https URL
- [ ] `curl https://[ngrok-url]/api/webhook/personalize` returns JSON

**Status**: [✓] Complete

---

### Step 6.2: Create ElevenLabs Conversational AI agent
**Why**: Core voice agent that answers calls and conducts conversations.

**Actions**:
1. Navigate to https://elevenlabs.io → Conversational AI
2. Click "Create Agent" or "+ New"
3. Configure basic settings:

| Setting | Value |
|---------|-------|
| Name | Voqo Real Estate Demo |
| LLM | GPT-4o |
| Temperature | 0.7 |

4. Set **First Message**:
```
Hi! Thanks for calling {{agency_name}}. I'm their AI assistant - how can I help you today?
```

5. Set **System Prompt** (full content from spec):
```
You are a friendly AI receptionist for {{agency_name}}, a real estate agency located in {{agency_location}}.

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

You're the first point of contact when the agency's human agents are unavailable.
Your job is to:
1. Make callers feel heard and helped
2. Understand what they're looking for
3. Gather enough info for a proper follow-up
4. Let them know we're preparing personalized info for them

You are NOT:
- A salesperson (don't push)
- A property database (don't make up listings)
- A booking system (don't promise specific times)

═══════════════════════════════════════════════════════════════
CONVERSATION FLOW
═══════════════════════════════════════════════════════════════

OPENING:
Start with a warm greeting that includes the agency name.
Example: "Hi! Thanks for calling {{agency_name}}. I'm their AI assistant - how can I help you today?"

DISCOVERY (2-3 questions, keep natural):

Question 1 - Intent:
"Are you looking to buy, sell, or rent?"
OR respond to what they've already told you.

Question 2 - Location:
"What area or suburb are you interested in?"
If they mention {{agency_location}}, acknowledge it.

Question 3 - Budget (ask gently, make optional):
"And roughly what price range are you looking at?"
If they seem hesitant: "No worries if you're not sure yet!"

Question 4 - Name:
"Can I get your name so we can follow up properly?"

ADAPT TO THE CALLER:
- If they give lots of info upfront, don't re-ask
- If they're chatty, engage briefly then guide back
- If they're brief, match their pace
- If they ask questions, answer honestly then continue

CLOSING:
Once you have: intent + location + name (budget is bonus), wrap up:

"Perfect, {{caller_name}}! I'm putting together some tailored property information for you right now. You'll see it pop up on the page you called from in just a moment. Thanks so much for calling {{agency_name}}!"

═══════════════════════════════════════════════════════════════
HANDLING SPECIFIC SCENARIOS
═══════════════════════════════════════════════════════════════

CALLER ASKS ABOUT SPECIFIC PROPERTY:
"I don't have the specific details on that one in front of me, but I'll make sure one of our agents gets back to you with all the info. What's your name?"

CALLER WANTS TO SPEAK TO A HUMAN:
"Of course! Our agents are currently with other clients, but I can make sure someone calls you back shortly. Can I get your name and a quick idea of what you need help with?"

CALLER IS JUST BROWSING:
"No problem at all! If you let me know what suburbs interest you, I can send you some options to look at in your own time."

CALLER ASKS IF YOU'RE AI:
"I am! I'm {{agency_name}}'s AI assistant - I help out when the team is busy. But I'll make sure a real person follows up with you. Now, what are you looking for today?"

CALLER IS CONFUSED OR OFF-TOPIC:
Gently guide back: "I'm here to help with property enquiries for {{agency_name}}. Are you looking to buy, sell, or rent in the area?"

CALLER IS RUDE OR AGGRESSIVE:
Stay professional: "I understand. Let me make sure someone from the team gets back to you. Can I get your name?"

═══════════════════════════════════════════════════════════════
WHAT YOU MUST NEVER DO
═══════════════════════════════════════════════════════════════

NEVER:
- Make up property details or addresses
- Quote specific prices for properties
- Promise specific callback times ("John will call in 10 minutes")
- Pretend to have access to systems you don't have
- Give legal or financial advice
- Ask more than 4-5 questions total
- Let the call drag past 2 minutes
- Sound robotic or read from a script

ALWAYS:
- Acknowledge what the caller says
- Be honest about your limitations
- Move toward the closing once you have key info
- Sound natural and conversational
```

6. Configure voice settings:
   - Browse Voice Library → Filter: Australian, Female
   - Select natural, professional voice (e.g., Charlotte, Sophie)
   - Test voice with sample before selecting

7. Advanced settings:
   - Max Duration: 180 seconds
   - Turn Timeout: 10 seconds

8. Save agent

**Verify**:
- [ ] Agent created with name "Voqo Real Estate Demo"
- [ ] First message includes `{{agency_name}}`
- [ ] System prompt pasted in full
- [x] Voice is Australian female (Kylie)

**Status**: [✓] Complete

---

### Step 6.3: Configure Webhooks
**Why**: Enable dynamic agency context injection and post-call processing.

**Actions**:
1. In agent settings, find "Webhooks" section
2. Configure **Personalization Webhook**:
   - URL: `https://[ngrok-url]/api/webhook/personalize`
   - Purpose: Called BEFORE each call to inject agency context
3. Configure **Post-Call Webhook**:
   - URL: `https://[ngrok-url]/api/webhook/call-complete`
   - Event: `post_call_transcription`
   - Purpose: Called AFTER call ends with transcript
4. Note webhook signing secret if provided
5. Save configuration

**Verify**:
- [ ] Personalization webhook URL set
- [ ] Post-call webhook URL set with correct event
- [x] Both URLs use ngrok HTTPS

**Status**: [✓] Complete

---

### Step 6.4: Import Twilio number to ElevenLabs
**Why**: Connect phone number to agent so calls route to AI.

**Actions**:
1. In ElevenLabs, go to Phone Numbers section
2. Click "Import Number" or "Add Phone Number"
3. Select Twilio as provider
4. Enter credentials from `.env.local`:
   - Phone Number: `+61XXXXXXXXX` (TWILIO_PHONE_NUMBER)
   - Account SID: `ACxxxxxxxx` (TWILIO_ACCOUNT_SID)
   - Auth Token: (TWILIO_AUTH_TOKEN)
5. Click Import/Verify
6. Assign agent: Select "Voqo Real Estate Demo"

**Note**: This auto-configures Twilio voice webhooks. Do not manually change Twilio settings after.

**Verify**:
- [ ] Phone number shows as connected
- [ ] Agent assigned to number
- [ ] No errors in import process

**Status**: [ ] Pending (BLOCKED: Twilio Auth Token invalid)

---

### Step 6.5: Note Agent ID and update .env.local
**Why**: App needs Agent ID for API calls and reference.

**Actions**:
1. In agent settings or URL, copy Agent ID
   - Usually visible in URL: `elevenlabs.io/app/conversational-ai/agents/[AGENT_ID]`
2. Update `.env.local`:
   ```
   ELEVENLABS_AGENT_ID=actual_agent_id_here
   ```
3. Update `NEXT_PUBLIC_DEMO_PHONE` with formatted number:
   ```
   NEXT_PUBLIC_DEMO_PHONE=+61 X XXXX XXXX
   ```
4. Restart dev server to pick up changes

**Verify**:
- [ ] Agent ID saved to `.env.local`
- [ ] Dev server restarted
- [x] `process.env.ELEVENLABS_AGENT_ID` accessible

**Status**: [✓] Complete

---

### Step 6.6: Test voice agent end-to-end
**Why**: Validate full flow works before proceeding.

**Actions**:
1. Ensure dev server running
2. Ensure ngrok running with same URL as webhooks
3. Watch ngrok web interface (http://127.0.0.1:4040) for webhook hits
4. Call Twilio number from a phone
5. Verify:
   - Agent answers with greeting
   - Check ngrok logs for `/api/webhook/personalize` hit
   - Have brief conversation (state intent, location, name)
   - End call
   - Check ngrok logs for `/api/webhook/call-complete` hit
6. Check terminal/logs for any errors

**Test conversation script**:
```
[Agent greets]
You: "Hi, I'm looking to buy in Surry Hills"
[Agent asks follow-up]
You: "Around 1 million dollars, looking for a 2 bedroom"
[Agent asks name]
You: "My name is Test User"
[Agent closes call]
```

**Verify**:
- [ ] Agent answers with default greeting (no agency context yet = uses fallback)
- [ ] Personalize webhook fires before call
- [ ] Conversation flows naturally
- [ ] Call-complete webhook fires after hangup
- [ ] No server errors in terminal

**Status**: [ ] Pending

---

### Step 6.7: Phase Checkpoint
**Why**: Ensure phase complete before moving on.

**Verify** (from IMPLEMENTATION_PLAN.md):
- [ ] ngrok running with HTTPS URL
- [ ] ElevenLabs agent created with full system prompt
- [ ] Webhooks configured with ngrok URLs
- [ ] Twilio number imported and assigned
- [ ] Agent ID saved to .env.local
- [ ] Test call works

**Status**: [ ] Pending

---

## VALIDATION

1. **Webhook accessibility**: `curl -X POST https://[ngrok-url]/api/webhook/personalize -H "Content-Type: application/json" -d '{}'` → returns JSON
2. **Agent responds**: Call number → hear AI greeting
3. **Personalization fires**: ngrok dashboard shows POST to /api/webhook/personalize
4. **Post-call fires**: After hangup, ngrok shows POST to /api/webhook/call-complete
5. **No errors**: Terminal shows clean logs, no 500 errors

---

## NOTES

- ngrok URL changes each restart - webhooks need updating
- For persistent URL, use ngrok paid plan or move to VPS (Phase 8)
- If personalize webhook fails, agent uses hardcoded fallback values
- Test with actual phone call, not browser - voice quality matters
