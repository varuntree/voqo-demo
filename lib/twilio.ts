import Twilio from 'twilio';

type TwilioClient = ReturnType<typeof Twilio>;

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

let client: TwilioClient | null = null;

function getTwilioClient(): TwilioClient {
  if (client) return client;
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) {
    throw new Error('Twilio is not configured (missing TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN)');
  }
  client = Twilio(accountSid, authToken);
  return client;
}

export async function sendSMS(to: string, message: string) {
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!from) {
    throw new Error('Twilio is not configured (missing TWILIO_PHONE_NUMBER)');
  }
  const twilio = getTwilioClient();
  return twilio.messages.create({
    body: message,
    to,
    from,
  });
}
