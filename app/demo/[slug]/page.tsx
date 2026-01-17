import { notFound } from 'next/navigation';
import { readFile } from 'fs/promises';
import path from 'path';
import { getDemoPhone } from '@/lib/phone';
import { isSafeSessionId } from '@/lib/ids';

interface Props {
  params: Promise<{ slug: string }>;
  searchParams?: Record<string, string | string[] | undefined>;
}

type MinimalAgencyForCall = {
  id: string;
  name?: string;
  location?: string;
  address?: string;
  phone?: string;
  website?: string;
};

function inferLocationFromAddress(address: string): string | undefined {
  const parts = address.split(',').map((p) => p.trim()).filter(Boolean);
  const tail = parts.length > 1 ? parts[parts.length - 1] : '';
  if (!tail) return undefined;

  const tokens = tail.split(/\s+/).filter(Boolean);
  while (tokens.length) {
    const last = tokens[tokens.length - 1];
    if (/^\d+$/.test(last)) {
      tokens.pop();
      continue;
    }
    if (/^[A-Z]{2,3}$/.test(last)) {
      tokens.pop();
      continue;
    }
    if (/^australia$/i.test(last)) {
      tokens.pop();
      continue;
    }
    break;
  }

  const candidate = tokens.join(' ').trim();
  return candidate.length ? candidate : undefined;
}

function normalizeAgencyForDemoCall(raw: unknown, slug: string): MinimalAgencyForCall {
  const safe = (raw && typeof raw === 'object') ? (raw as Record<string, unknown>) : {};

  const id =
    (typeof safe.id === 'string' && safe.id) ||
    (typeof safe.agencyId === 'string' && safe.agencyId) ||
    slug;

  const name =
    (typeof safe.name === 'string' && safe.name) ||
    (typeof safe.agencyName === 'string' && safe.agencyName) ||
    undefined;

  const website =
    (typeof safe.website === 'string' && safe.website) ||
    (typeof (safe as any)?.contact?.website === 'string' && (safe as any).contact.website) ||
    undefined;

  const phone =
    (typeof safe.phone === 'string' && safe.phone) ||
    (typeof (safe as any)?.contact?.phone === 'string' && (safe as any).contact.phone) ||
    undefined;

  const address =
    (typeof safe.address === 'string' && safe.address) ||
    (typeof (safe as any)?.contact?.address === 'string' && (safe as any).contact.address) ||
    undefined;

  const location =
    (typeof safe.location === 'string' && safe.location) ||
    (address ? inferLocationFromAddress(address) : undefined) ||
    undefined;

  return { id, name, location, address, phone, website };
}

function injectDemoCallScript(
  html: string,
  config: {
    demoPhone: ReturnType<typeof getDemoPhone>;
    agency: MinimalAgencyForCall;
    sessionId?: string | null;
  }
) {
  const injectedMarker = 'window.__VOQO_DEMO_PHONE__';
  if (html.includes(injectedMarker)) return html;

  const safeSessionId = config.sessionId && isSafeSessionId(config.sessionId) ? config.sessionId : null;

  const configScript =
    `<script>(function(){` +
    `window.__VOQO_DEMO_PHONE__=${JSON.stringify(config.demoPhone)};` +
    `window.__VOQO_AGENCY__=${JSON.stringify(config.agency)};` +
    (safeSessionId ? `window.__VOQO_SESSION_ID__=${JSON.stringify(safeSessionId)};` : '') +
    `})();</script>` +
    `<script src="/voqo-demo-call.js" defer></script>`;

  // Prefer injecting into <head> so the call activation script loads as early as possible.
  if (html.includes('</head>')) {
    return html.replace('</head>', `${configScript}</head>`);
  }
  if (html.includes('</body>')) {
    return html.replace('</body>', `${configScript}</body>`);
  }
  return `${html}\n${configScript}\n`;
}

export default async function DemoPage({ params, searchParams }: Props) {
  const { slug: rawSlug } = await params;
  const slug = rawSlug.endsWith('.html') ? rawSlug.replace(/\.html$/, '') : rawSlug;
  const filePath = path.join(process.cwd(), 'public', 'demo', `${slug}.html`);

  let html: string;
  try {
    html = await readFile(filePath, 'utf-8');
  } catch {
    notFound();
  }

  const demoPhone = getDemoPhone();
  let agencyRaw: unknown | null = null;
  try {
    const agencyPath = path.join(process.cwd(), 'data', 'agencies', `${slug}.json`);
    const agencyFileContents = await readFile(agencyPath, 'utf-8');
    agencyRaw = JSON.parse(agencyFileContents) as unknown;
  } catch {
    agencyRaw = { id: slug };
  }

  const agency = normalizeAgencyForDemoCall(agencyRaw, slug);
  const sessionParamRaw = searchParams?.session;
  const sessionId =
    typeof sessionParamRaw === 'string'
      ? sessionParamRaw
      : Array.isArray(sessionParamRaw)
        ? sessionParamRaw[0]
        : null;
  const injected = injectDemoCallScript(html, { demoPhone, agency, sessionId });

  return (
    <div suppressHydrationWarning dangerouslySetInnerHTML={{ __html: injected }} />
  );
}

export async function generateMetadata({ params }: Props) {
  const { slug: rawSlug } = await params;
  const slug = rawSlug.endsWith('.html') ? rawSlug.replace(/\.html$/, '') : rawSlug;
  return {
    title: `${slug} | Voqo AI Demo`,
  };
}
