import { notFound } from 'next/navigation';
import { readFile } from 'fs/promises';
import path from 'path';

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function DemoPage({ params }: Props) {
  const { slug: rawSlug } = await params;
  const slug = rawSlug.endsWith('.html') ? rawSlug.replace(/\.html$/, '') : rawSlug;
  const filePath = path.join(process.cwd(), 'public', 'demo', `${slug}.html`);

  let html: string;
  try {
    html = await readFile(filePath, 'utf-8');
  } catch {
    notFound();
  }

  return (
    <div dangerouslySetInnerHTML={{ __html: html }} />
  );
}

export async function generateMetadata({ params }: Props) {
  const { slug: rawSlug } = await params;
  const slug = rawSlug.endsWith('.html') ? rawSlug.replace(/\.html$/, '') : rawSlug;
  return {
    title: `${slug} | Voqo AI Demo`,
  };
}
