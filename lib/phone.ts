export interface DemoPhone {
  raw: string;
  digits: string;
  display: string;
  tel: string;
}

const REQUIRED_LOCAL = '04832945767';
const REQUIRED_E164 = '+614832945767';

function stripToPhoneChars(input: string): string {
  return input.replace(/[^\d+]/g, '');
}

function digitsOnly(input: string): string {
  return input.replace(/[^\d]/g, '');
}

function toE164IfLikelyAuMobile(raw: string): string {
  const cleaned = stripToPhoneChars(raw);
  if (cleaned.startsWith('+')) return cleaned;

  const digits = digitsOnly(cleaned);
  // Australian mobile numbers are typically 10 digits starting with 04.
  if ((digits.length === 10 || digits.length === 11) && digits.startsWith('04')) {
    return `+61${digits.slice(1)}`;
  }
  // If user provided 11 digits starting with 0 (sometimes with leading zeros), best effort.
  if (digits.length === 11 && digits.startsWith('0')) {
    return `+61${digits.slice(1)}`;
  }
  return digits.length > 0 ? `+${digits}` : cleaned;
}

function toDisplayIfAu(raw: string): string {
  const cleaned = stripToPhoneChars(raw);
  if (!cleaned) return raw;

  if (cleaned.startsWith('+61')) {
    const digits = digitsOnly(cleaned);
    if (digits.startsWith('61') && digits.length === 11) {
      return `0${digits.slice(2)}`;
    }
  }
  if (digitsOnly(cleaned).startsWith('04')) return digitsOnly(cleaned);
  return raw;
}

export function getDemoPhone(): DemoPhone {
  // Enforce a single demo number across UI + agents. Env is used only if it matches.
  const envCandidate =
    process.env.DEMO_DIAL_NUMBER ||
    process.env.NEXT_PUBLIC_DEMO_PHONE ||
    process.env.TWILIO_PHONE_NUMBER ||
    '';

  const candidateE164 = envCandidate ? toE164IfLikelyAuMobile(envCandidate) : '';
  const candidateDigits = digitsOnly(candidateE164);
  const requiredDigits = digitsOnly(REQUIRED_E164);

  const useEnv = candidateDigits === requiredDigits || digitsOnly(envCandidate) === digitsOnly(REQUIRED_LOCAL);

  const tel = useEnv ? candidateE164 : REQUIRED_E164;
  const display = useEnv ? toDisplayIfAu(candidateE164) : REQUIRED_LOCAL;
  const digits = digitsOnly(tel);

  return { raw: useEnv ? envCandidate : REQUIRED_LOCAL, digits, display, tel };
}
