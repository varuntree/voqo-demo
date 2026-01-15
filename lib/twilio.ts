import Twilio from 'twilio';

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

const client = Twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

export async function sendSMS(to: string, message: string) {
  return client.messages.create({
    body: message,
    to,
    from: process.env.TWILIO_PHONE_NUMBER!,
  });
}

export default client;
