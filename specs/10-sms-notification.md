# Spec 10: SMS Notification After Call

Send SMS to caller with link to their personalized property page after generation completes.

## Overview

| Aspect | Detail |
|--------|--------|
| Trigger | Post-call page generation completes successfully |
| Source | Same Twilio number (+61483943567) |
| Message | Branded: `"{Agency} found properties for you: {url}"` |
| Failure | Log error, don't retry |
| URL | `${NEXT_PUBLIC_APP_URL}/call/${callId}` |

---

## Integration Point

**File:** `lib/postcall-queue.ts`

**Location:** After HTML file verification succeeds (around line 95-100)

```
Current flow:
1. Job dequeued
2. Claude Code generates HTML
3. Verify HTML file exists ← SUCCESS
4. Update call JSON with pageUrl
5. Update agency calls
6. Delete job file

New flow:
1. Job dequeued
2. Claude Code generates HTML
3. Verify HTML file exists ← SUCCESS
4. Update call JSON with pageUrl
5. **Send SMS to caller** ← NEW
6. Update agency calls
7. Delete job file
```

---

## Implementation

### 1. Phone Number Normalization

ElevenLabs sends various formats. Normalize to E.164 before sending.

**Add to `lib/twilio.ts`:**

```typescript
export function normalizePhoneNumber(phone: string): string {
  // Remove all non-digit characters except leading +
  let cleaned = phone.replace(/[^\d+]/g, '');

  // Ensure E.164 format
  if (!cleaned.startsWith('+')) {
    // Assume Australian if starts with 0
    if (cleaned.startsWith('0')) {
      cleaned = '+61' + cleaned.slice(1);
    } else if (cleaned.startsWith('61')) {
      cleaned = '+' + cleaned;
    } else {
      cleaned = '+' + cleaned;
    }
  }

  return cleaned;
}
```

### 2. SMS Sending Function

**Already exists in `lib/twilio.ts`:**

```typescript
export async function sendSMS(to: string, message: string) {
  return client.messages.create({
    body: message,
    to,
    from: process.env.TWILIO_PHONE_NUMBER!,
  });
}
```

### 3. Post-Call SMS Function

**Add to `lib/postcall-queue.ts` or new file `lib/postcall-sms.ts`:**

```typescript
import { sendSMS, normalizePhoneNumber } from './twilio';

interface SendPostcallSMSParams {
  callerPhone: string;
  agencyName: string;
  callId: string;
}

export async function sendPostcallSMS({
  callerPhone,
  agencyName,
  callId,
}: SendPostcallSMSParams): Promise<void> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const pageUrl = `${baseUrl}/call/${callId}`;

  const message = `${agencyName} found properties for you: ${pageUrl}`;

  try {
    const normalizedPhone = normalizePhoneNumber(callerPhone);
    await sendSMS(normalizedPhone, message);
    console.log(`[SMS] Sent to ${normalizedPhone} for call ${callId}`);
  } catch (error) {
    console.error(`[SMS] Failed for call ${callId}:`, error);
    // Log error but don't throw - page generation succeeded
  }
}
```

### 4. Integration in Queue Worker

**Modify `lib/postcall-queue.ts` processJob function:**

After successful page generation (after `updateCallWithPageUrl`):

```typescript
// Send SMS notification
const callData = JSON.parse(
  await fs.readFile(`data/calls/${job.callId}.json`, 'utf-8')
);

if (callData.callerPhone) {
  await sendPostcallSMS({
    callerPhone: callData.callerPhone,
    agencyName: callData.agencyName || 'Voqo',
    callId: job.callId,
  });
}
```

---

## Data Requirements

**From call data (`/data/calls/{callId}.json`):**
- `callerPhone` - Required for SMS destination
- `agencyName` - For branded message
- `callId` - For URL construction

**From environment:**
- `NEXT_PUBLIC_APP_URL` - Base URL for page link
- `TWILIO_PHONE_NUMBER` - SMS sender (existing)
- `TWILIO_ACCOUNT_SID` - Auth (existing)
- `TWILIO_AUTH_TOKEN` - Auth (existing)

---

## Error Handling

| Scenario | Action |
|----------|--------|
| SMS send fails | Log error, continue (page still accessible) |
| Invalid phone format | Log warning, skip SMS |
| Missing callerPhone | Skip SMS silently |
| Twilio rate limit | Log error, no retry |

**Error logging:** Append to existing error tracking or console.error

---

## Message Format

**Template:**
```
{agencyName} found properties for you: {pageUrl}
```

**Examples:**
- `Ray White Surry Hills found properties for you: https://demo.voqo.ai/call/call-1768493009666-fe33yd`
- `Blossom Properties found properties for you: https://demo.voqo.ai/call/call-1768490455973-xarrhg`

**Character count:** ~80-120 chars (well under 160 SMS limit)

---

## Testing

### Manual Test
1. Make test call to demo number
2. Complete call with property requirements
3. Wait for page generation (~30-60s)
4. Verify SMS received on caller phone
5. Click link, verify page loads

### Verification Checklist
- [ ] SMS received within 2 minutes of call end
- [ ] Phone number correctly formatted
- [ ] Agency name appears in message
- [ ] URL is clickable and works
- [ ] Page shows correct caller's data

---

## Files to Modify

| File | Change |
|------|--------|
| `lib/twilio.ts` | Add `normalizePhoneNumber()` function |
| `lib/postcall-queue.ts` | Add SMS call after page generation |

**No new env vars needed** - all Twilio credentials already configured.

---

## Sequence Diagram

```
Call Ends
    │
    ▼
ElevenLabs Webhook ──► /api/webhook/call-complete
    │
    ▼
Save call data (includes callerPhone)
    │
    ▼
Enqueue postcall job
    │
    ▼
Queue worker processes job
    │
    ▼
Claude Code generates HTML page
    │
    ▼
Verify HTML exists ✓
    │
    ▼
Update call JSON with pageUrl
    │
    ▼
Send SMS to callerPhone ◄── NEW
    │
    ▼
Update agency calls
    │
    ▼
Done
```

---

## Edge Cases

1. **No callerPhone in data** - Skip SMS, log info message
2. **Anonymous/blocked caller** - Skip SMS if number is invalid
3. **International numbers** - normalizePhoneNumber handles various formats
4. **Page generation failed** - SMS never sent (only on success)
5. **Duplicate SMS** - Not possible; SMS sent once per successful generation
