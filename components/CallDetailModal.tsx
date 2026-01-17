'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import ActivityMessageRow from '@/components/ActivityMessage';
import type { Activity, ActivityMessage } from '@/lib/types';

type TranscriptEntry = { role: 'agent' | 'user'; message: string };

function formatTimestamp(iso: string): string {
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return iso;
  return new Date(ts).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function contentKey(message: ActivityMessage): string {
  return `${message.type}|${message.text}|${message.detail || ''}|${message.source || ''}|${message.timestamp}`;
}

function StatusLabel({ status }: { status: string }) {
  const normalized = status || 'generating';
  const styles = (() => {
    if (normalized === 'completed') return 'bg-green-500/15 text-green-300 border-green-500/20';
    if (normalized === 'failed') return 'bg-red-500/15 text-red-300 border-red-500/20';
    return 'bg-amber-500/15 text-amber-300 border-amber-500/20';
  })();
  const label = normalized === 'completed' ? 'Ready' : normalized === 'failed' ? 'Failed' : 'Generating';
  return <span className={`px-2 py-0.5 text-xs rounded-full border ${styles}`}>{label}</span>;
}

export default function CallDetailModal({
  callId,
  onClose,
}: {
  callId: string;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [call, setCall] = useState<Record<string, any> | null>(null);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [activityMessages, setActivityMessages] = useState<ActivityMessage[]>([]);
  const [activityStatus, setActivityStatus] = useState<'active' | 'complete' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const seenKeysRef = useRef<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const esRef = useRef<EventSource | null>(null);

  const pageStatus = String(call?.pageStatus ?? 'generating');
  const agencyName = String(call?.agencyName ?? 'Unknown');
  const timestamp = typeof call?.timestamp === 'string' ? call.timestamp : '';
  const pageUrl = typeof call?.pageUrl === 'string' ? call.pageUrl : null;

  const transcript: TranscriptEntry[] = useMemo(() => {
    if (Array.isArray(call?.transcriptRaw)) {
      return call.transcriptRaw.filter((t: any) => t && (t.role === 'agent' || t.role === 'user') && typeof t.message === 'string');
    }
    if (typeof call?.transcript === 'string' && call.transcript.trim().length) {
      // Fallback: render as a single block.
      return [{ role: 'agent', message: call.transcript }];
    }
    return [];
  }, [call]);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [activityMessages.length]);

  useEffect(() => {
    let aborted = false;
    setLoading(true);
    setError(null);
    setCall(null);
    setActivity(null);
    setActivityMessages([]);
    setActivityStatus(null);
    seenIdsRef.current = new Set();
    seenKeysRef.current = new Set();

    (async () => {
      try {
        const res = await fetch(`/api/calls/${encodeURIComponent(callId)}`, { cache: 'no-store' });
        const data = await res.json();
        if (aborted) return;
        if (!res.ok) {
          setError(data?.error || 'Failed to load call');
          setLoading(false);
          return;
        }
        setCall((data?.call as any) ?? null);
        const act = (data?.postcallActivity as Activity | null) ?? null;
        setActivity(act);
        const initial = act?.messages ?? [];
        setActivityMessages(initial);
        setActivityStatus(act?.status ?? null);
        seenIdsRef.current = new Set(initial.map((m) => m.id));
        seenKeysRef.current = new Set(initial.map((m) => contentKey(m)));
        setLoading(false);
      } catch (e) {
        if (aborted) return;
        setError('Failed to load call');
        setLoading(false);
      }
    })();

    return () => {
      aborted = true;
    };
  }, [callId]);

  useEffect(() => {
    esRef.current?.close();
    esRef.current = null;

    const es = new EventSource(`/api/calls/stream-detail?callId=${encodeURIComponent(callId)}`);
    esRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (!data || typeof data.type !== 'string') return;

        if (data.type === 'call_update' && data.call) {
          setCall(data.call);
          return;
        }

        if (data.type === 'postcall_activity_status') {
          if (data.status === 'active' || data.status === 'complete') {
            setActivityStatus(data.status);
          }
          return;
        }

        if (data.type === 'postcall_activity_message' && data.message) {
          const msg = data.message as ActivityMessage;
          const seenIds = seenIdsRef.current;
          const seenKeys = seenKeysRef.current;
          const key = contentKey(msg);
          if (seenIds.has(msg.id) || seenKeys.has(key)) return;
          seenIds.add(msg.id);
          seenKeys.add(key);
          setActivityMessages((prev) => [...prev, msg].slice(-400));
        }
      } catch {
        // ignore
      }
    };

    es.onerror = () => {
      // keep the modal usable even if streaming fails
    };

    return () => {
      es.close();
      if (esRef.current === es) esRef.current = null;
    };
  }, [callId]);

  const toolStreamVisible = pageStatus !== 'completed';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/70"
        onClick={onClose}
        aria-label="Close modal"
      />

      <div className="relative w-full max-w-5xl bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl">
        <div className="px-5 py-4 border-b border-slate-700 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h3 className="text-white font-semibold truncate">{agencyName}</h3>
              <StatusLabel status={pageStatus} />
              {timestamp ? (
                <span className="text-slate-500 text-sm">• {formatTimestamp(timestamp)}</span>
              ) : null}
            </div>
            <div className="mt-1 text-xs text-slate-500 truncate">
              {callId}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {pageUrl && pageStatus === 'completed' && (
              <a
                href={pageUrl}
                className="px-3 py-1.5 text-sm rounded-lg bg-blue-500/15 text-blue-200 hover:bg-blue-500/25 transition-colors"
              >
                Open Page
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-sm rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-6 text-slate-500 text-sm">Loading call details…</div>
        ) : error ? (
          <div className="p-6 text-red-300 text-sm">{error}</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-5">
            <div className="lg:col-span-3 p-5 border-b lg:border-b-0 lg:border-r border-slate-700">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-slate-200 text-sm font-medium">Transcript</h4>
                {toolStreamVisible && (
                  <div className="text-xs text-slate-500">
                    Post-call page: {activityStatus === 'active' ? 'running' : activityStatus === 'complete' ? 'finished' : 'pending'}
                  </div>
                )}
              </div>

              {transcript.length === 0 ? (
                <p className="text-slate-500 text-sm">No transcript available yet.</p>
              ) : (
                <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-transparent">
                  {transcript.map((t, idx) => {
                    const isCaller = t.role === 'user';
                    return (
                      <div key={`${t.role}-${idx}`} className={`flex ${isCaller ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed border ${
                            isCaller
                              ? 'bg-blue-500/10 border-blue-500/20 text-slate-100'
                              : 'bg-slate-800/60 border-slate-700 text-slate-100'
                          }`}
                        >
                          <div className="text-[11px] text-slate-500 mb-1">
                            {isCaller ? 'Caller' : 'Agent'}
                          </div>
                          <div className="whitespace-pre-wrap">{t.message}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="lg:col-span-2 p-5">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-slate-200 text-sm font-medium">Post-call generation</h4>
                {activityStatus === 'active' && (
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="w-1.5 h-1.5 bg-amber-300 rounded-full animate-pulse" />
                    <span>Live</span>
                  </div>
                )}
              </div>

              {activityMessages.length === 0 ? (
                <p className="text-slate-500 text-sm">
                  {pageStatus === 'completed' ? 'No generation activity recorded.' : 'Waiting for post-call agent activity…'}
                </p>
              ) : (
                <div
                  ref={scrollRef}
                  className="max-h-[50vh] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-transparent"
                >
                  {activityMessages.slice(-200).map((msg) => (
                    <ActivityMessageRow key={msg.id} message={msg} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

