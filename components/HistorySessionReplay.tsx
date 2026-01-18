'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import AgencyCard from '@/components/AgencyCard';
import MainAgentWorkspace from '@/components/MainAgentWorkspace';
import type { ActivityMessage, AgencyProgress, HistorySessionDetail } from '@/lib/types';

export default function HistorySessionReplay({ sessionId }: { sessionId: string }) {
  const [detail, setDetail] = useState<HistorySessionDetail | null>(null);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [collapsedAgencyIds, setCollapsedAgencyIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`/api/history/${encodeURIComponent(sessionId)}`);
        if (!res.ok) {
          const payload = await res.json().catch(() => null);
          const message = payload?.error || 'Session not found';
          if (!cancelled) setError(message);
          return;
        }
        const data = (await res.json()) as HistorySessionDetail;
        if (!cancelled) setDetail(data);
      } catch {
        if (!cancelled) setError('Failed to load session');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const cards = useMemo(() => {
    const agencies = detail?.agencies || [];
    return [...agencies].sort((a, b) => {
      const statusOrder = { complete: 0, generating: 1, extracting: 2, skeleton: 3, error: 4 };
      return statusOrder[a.status] - statusOrder[b.status];
    });
  }, [detail?.agencies]);

  const completionStats = useMemo(() => {
    const agencies = detail?.agencies || [];
    const success = agencies.filter((a) => a.status === 'complete').length;
    const failed = agencies.filter((a) => a.status === 'error').length;
    return { total: agencies.length, success, failed };
  }, [detail?.agencies]);

  const headerMeta = useMemo(() => {
    if (!detail) return null;
    const created = detail.session.createdAt ? new Date(detail.session.createdAt) : null;
    return { createdLabel: created ? created.toLocaleString() : null };
  }, [detail]);

  const status = (detail?.pipeline.status || 'complete') as
    | 'idle'
    | 'searching'
    | 'processing'
    | 'complete'
    | 'error'
    | 'cancelled';

  const mainMessages = (detail?.activity?.messages || []) as ActivityMessage[];
  const found = detail?.activity?.agenciesFound || 0;
  const target = detail?.activity?.agenciesTarget || detail?.pipeline.requestedCount || 0;

  const subagentActivity = detail?.subagentActivity || {};

  return (
    <div className="min-h-screen bg-[#FDFCF8]">
      <header className="border-b border-stone-200 bg-white/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/product?tab=history"
              className="text-stone-500 hover:text-stone-900 transition-colors text-sm font-mono"
            >
              ← Back to History
            </Link>
            <span className="text-stone-300">/</span>
            <span className="text-stone-900 font-semibold truncate">
              {detail?.session.name || sessionId}
            </span>
          </div>
          {headerMeta?.createdLabel && (
            <span className="text-xs text-stone-400 shrink-0 font-mono">{headerMeta.createdLabel}</span>
          )}
        </div>
      </header>

      <section className="py-8 px-4">
        <div className="max-w-6xl mx-auto">
          {loading && (
            <div className="flex items-center gap-3 text-stone-500">
              <svg className="animate-spin h-5 w-5 text-[#00C853]" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              <span className="font-mono">Loading session…</span>
            </div>
          )}

          {!loading && error && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-600">
              {error}
            </div>
          )}

          {!loading && detail && (
            <>
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
                <div className="min-w-0">
                  <h1 className="text-2xl font-bold text-stone-900 truncate">{detail.session.name}</h1>
                  <p className="text-sm text-stone-500 mt-1 font-mono">
                    {detail.session.suburb} • {detail.session.actualCount} agencies •{' '}
                    {detail.session.successCount} demos generated
                  </p>
                </div>
                {(detail.pipeline.status === 'complete' ||
                  detail.pipeline.status === 'error' ||
                  detail.pipeline.status === 'cancelled') && (
                  <div className="bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-sm text-stone-600">
                    <span className="text-stone-400">Result:</span>{' '}
                    <span className="text-stone-900 font-medium">
                      {completionStats.success}/{completionStats.total}
                    </span>
                    {completionStats.failed > 0 && (
                      <span className="text-amber-600"> • {completionStats.failed} failed</span>
                    )}
                  </div>
                )}
              </div>

              <div className="mb-6">
                <MainAgentWorkspace
                  status={status}
                  todos={detail.pipeline.todos || []}
                  messages={mainMessages}
                  found={found}
                  target={target}
                  onCancel={() => {}}
                  canCancel={false}
                />
              </div>

              {cards.length > 0 && (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {cards.map((card: AgencyProgress) => (
                    <AgencyCard
                      key={card.agencyId}
                      data={card}
                      activity={subagentActivity[card.agencyId] || []}
                      isExpanded={!collapsedAgencyIds.has(card.agencyId)}
                      onToggleExpand={() => {
                        setCollapsedAgencyIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(card.agencyId)) next.delete(card.agencyId);
                          else next.add(card.agencyId);
                          return next;
                        });
                      }}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
