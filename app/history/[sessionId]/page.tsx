import HistorySessionReplay from '@/components/HistorySessionReplay';

export const dynamic = 'force-dynamic';

export default async function HistorySessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return <HistorySessionReplay sessionId={sessionId} />;
}

