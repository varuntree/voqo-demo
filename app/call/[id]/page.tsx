import { notFound } from 'next/navigation';
import { readFile } from 'fs/promises';
import path from 'path';
import { isSafeCallId, stripHtmlSuffix } from '@/lib/ids';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Props {
  params: Promise<{ id: string }>;
}

export default async function CallPage({ params }: Props) {
  const { id: rawId } = await params;
  const id = stripHtmlSuffix(rawId);
  if (!isSafeCallId(id)) notFound();
  const filePath = path.join(process.cwd(), 'public', 'call', `${id}.html`);

  let html: string;
  try {
    html = await readFile(filePath, 'utf-8');
  } catch {
    notFound();
  }

  return (
    <div suppressHydrationWarning dangerouslySetInnerHTML={{ __html: html }} />
  );
}

export async function generateMetadata({ params }: Props) {
  const { id: rawId } = await params;
  const id = stripHtmlSuffix(rawId);
  return {
    title: `Call ${id} | Voqo AI`,
  };
}
