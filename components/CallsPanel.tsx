'use client';

import type { ReactNode } from 'react';

export type CallListItem = {
  callId: string;
  timestamp: string;
  agencyId: string;
  agencyName: string;
  pageStatus: string;
  pageUrl: string | null;
  duration?: number | null;
  callerName?: string | null;
  summary?: string | null;
};

function formatRelativeTime(iso: string): string {
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return iso;
  const deltaMs = Date.now() - ts;
  const sec = Math.floor(deltaMs / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

function StatusPill({ status }: { status: string }) {
  const normalized = status || 'generating';
  const styles = (() => {
    if (normalized === 'completed') return 'bg-green-500/15 text-green-300 border-green-500/20';
    if (normalized === 'failed') return 'bg-red-500/15 text-red-300 border-red-500/20';
    return 'bg-amber-500/15 text-amber-300 border-amber-500/20';
  })();

  const label = normalized === 'completed' ? 'Ready' : normalized === 'failed' ? 'Failed' : 'Generating';

  return (
    <span className={`px-2 py-0.5 text-[11px] rounded-full border ${styles}`}>
      {label}
    </span>
  );
}

export default function CallsPanel({
  calls,
  loading,
  emptyState,
  selectedCallId,
  onSelectCall,
}: {
  calls: CallListItem[];
  loading?: boolean;
  emptyState?: ReactNode;
  selectedCallId?: string | null;
  onSelectCall: (callId: string) => void;
}) {
  if (loading) {
    return <p className="text-slate-500 text-sm">Loading calls…</p>;
  }

  if (!calls.length) {
    return (
      <div className="text-slate-500 text-sm">
        {emptyState ?? 'No calls yet.'}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {calls.map((call) => {
        const isActive = selectedCallId === call.callId;
        return (
          <button
            key={call.callId}
            type="button"
            onClick={() => onSelectCall(call.callId)}
            className={`w-full text-left rounded-xl border px-3 py-2 transition-colors ${
              isActive
                ? 'bg-slate-700/40 border-slate-600'
                : 'bg-slate-900/30 border-slate-700 hover:bg-slate-800/40'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm text-slate-100 font-medium truncate">{call.agencyName}</div>
                <div className="text-xs text-slate-500 truncate">{call.callId}</div>
              </div>
              <StatusPill status={call.pageStatus} />
            </div>

            <div className="mt-2 flex items-center justify-between gap-2">
              <div className="text-xs text-slate-500">
                {formatRelativeTime(call.timestamp)}
                {typeof call.duration === 'number' ? ` • ${call.duration}s` : ''}
              </div>
              {call.pageUrl && call.pageStatus === 'completed' && (
                <span className="text-xs text-blue-300">Open page</span>
              )}
            </div>

            {call.summary && (
              <div className="mt-2 text-xs text-slate-400 line-clamp-2">
                {call.summary}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

