'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import AgencyCard from '@/components/AgencyCard';
import TabNavigation from '@/components/TabNavigation';
import HistoryList from '@/components/HistoryList';
import MainAgentWorkspace from '@/components/MainAgentWorkspace';
import CallsPanel, { type CallListItem } from '@/components/CallsPanel';
import CallDetailModal from '@/components/CallDetailModal';
import SettingsModal from '@/components/SettingsModal';
import { AgencyProgress, SearchSession, ActivityMessage } from '@/lib/types';

interface Todo {
  id: string;
  text: string;
  status: 'pending' | 'in_progress' | 'complete';
}

type PipelineStatus = 'idle' | 'searching' | 'processing' | 'complete' | 'error' | 'cancelled';

const ACTIVE_SESSION_STORAGE_KEY = 'voqo:activePipelineSessionId';

export default function Home() {
  // Tab state
  const [activeTab, setActiveTab] = useState<'search' | 'history'>('search');

  // Search state
  const [suburb, setSuburb] = useState('');
  const [agencyCount, setAgencyCount] = useState(10);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus>('idle');
  const [todos, setTodos] = useState<Todo[]>([]);
  const [cards, setCards] = useState<Map<string, AgencyProgress>>(new Map());
  const [removingCards, setRemovingCards] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const [completionStats, setCompletionStats] = useState<{
    total: number;
    success: number;
    failed: number;
  } | null>(null);

  // History state
  const [history, setHistory] = useState<SearchSession[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Activity state
  const [mainActivityMessages, setMainActivityMessages] = useState<ActivityMessage[]>([]);
  const [mainFound, setMainFound] = useState(0);
  const [mainTarget, setMainTarget] = useState(0);
  const [subagentActivity, setSubagentActivity] = useState<Map<string, ActivityMessage[]>>(
    new Map()
  );
  const [collapsedAgencyIds, setCollapsedAgencyIds] = useState<Set<string>>(new Set());
  const eventSourceRef = useRef<EventSource | null>(null);
  const seenMainMessageIdsRef = useRef<Set<string>>(new Set());
  const seenMainMessageKeysRef = useRef<Set<string>>(new Set());
  const seenSubagentMessageIdsRef = useRef<Map<string, Set<string>>>(new Map());
  const seenSubagentMessageKeysRef = useRef<Map<string, Set<string>>>(new Map());

  // Calls panel state (workspace)
  const [callsOpen, setCallsOpen] = useState(false);

  // Settings modal state
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [callsLoading, setCallsLoading] = useState(false);
  const [calls, setCalls] = useState<CallListItem[]>([]);
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const callsEventSourceRef = useRef<EventSource | null>(null);

  const persistActiveSessionId = useCallback((id: string) => {
    try {
      window.localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, id);
    } catch {
      // ignore
    }
  }, []);

  const clearActiveSessionId = useCallback(() => {
    try {
      window.localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  // Load history when tab changes to history
  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory();
    }
  }, [activeTab]);

  // Deep-link tab support: /?tab=history
  useEffect(() => {
    try {
      const tab = new URLSearchParams(window.location.search).get('tab');
      if (tab === 'history') {
        setActiveTab('history');
      }
    } catch {
      // ignore
    }
  }, []);

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch('/api/history');
      const data = await res.json();
      setHistory(data.sessions || []);
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const resetSeenMessageCaches = () => {
    seenMainMessageIdsRef.current = new Set();
    seenMainMessageKeysRef.current = new Set();
    seenSubagentMessageIdsRef.current = new Map();
    seenSubagentMessageKeysRef.current = new Map();
  };

  const messageKey = (message: ActivityMessage) =>
    `${message.type}|${message.text}|${message.detail || ''}|${message.source || ''}|${message.timestamp}`;

  const fetchCalls = useCallback(async () => {
    setCallsLoading(true);
    try {
      const res = await fetch('/api/calls', { cache: 'no-store' });
      const data = await res.json();
      setCalls(Array.isArray(data?.calls) ? (data.calls as CallListItem[]) : []);
    } catch {
      setCalls([]);
    } finally {
      setCallsLoading(false);
    }
  }, []);

  // Calls list streaming (only while the panel is open)
  useEffect(() => {
    callsEventSourceRef.current?.close();
    callsEventSourceRef.current = null;

    if (!callsOpen) return;

    void fetchCalls();

    const es = new EventSource('/api/calls/stream');
    callsEventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data?.type === 'calls_update' && Array.isArray(data.calls)) {
          setCalls(data.calls as CallListItem[]);
        }
      } catch {
        // ignore
      }
    };

    es.onerror = () => {
      // ignore; panel still works with last-known list
    };

    return () => {
      es.close();
      if (callsEventSourceRef.current === es) callsEventSourceRef.current = null;
    };
  }, [callsOpen, fetchCalls]);

  // Rehydrate an in-progress pipeline after reload
  useEffect(() => {
    if (sessionId) return;

    let storedSessionId: string | null = null;
    try {
      storedSessionId = window.localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY);
    } catch {
      storedSessionId = null;
    }

    if (!storedSessionId) return;

    (async () => {
      try {
        const res = await fetch(`/api/pipeline/state?session=${encodeURIComponent(storedSessionId!)}`);
        if (!res.ok) {
          clearActiveSessionId();
          return;
        }

        const data = await res.json();
        const pipeline = data.pipeline as {
          suburb?: string;
          requestedCount?: number;
          status?: PipelineStatus;
          todos?: Todo[];
          agencyIds?: string[];
        };

        const pipelineSuburb = typeof pipeline.suburb === 'string' ? pipeline.suburb : '';
        const requestedCount = typeof pipeline.requestedCount === 'number' ? pipeline.requestedCount : agencyCount;
        const status = (pipeline.status as PipelineStatus) || 'searching';

        setSuburb(pipelineSuburb);
        setAgencyCount(requestedCount);
        setSessionId(storedSessionId);
        setPipelineStatus(status);
        setTodos(Array.isArray(pipeline.todos) ? pipeline.todos : []);
        setError('');
        setCompletionStats(null);
        setRemovingCards(new Set());
        setCollapsedAgencyIds(new Set());
        resetSeenMessageCaches();

        const agencies = (Array.isArray(data.agencies) ? data.agencies : []) as AgencyProgress[];
        const nextCards = new Map<string, AgencyProgress>();
        for (const agency of agencies) {
          nextCards.set(agency.agencyId, agency);
        }
        setCards(nextCards);

        const isTerminal = status === 'complete' || status === 'error' || status === 'cancelled';

        const mainActivity = data.mainActivity as {
          messages?: ActivityMessage[];
          agenciesFound?: number;
          agenciesTarget?: number;
        } | null;

        if (mainActivity && Array.isArray(mainActivity.messages)) {
          seenMainMessageIdsRef.current = new Set(mainActivity.messages.map((m) => m.id));
          seenMainMessageKeysRef.current = new Set(mainActivity.messages.map(messageKey));
          setMainActivityMessages(mainActivity.messages.slice(-400));
        } else {
          setMainActivityMessages([]);
          seenMainMessageIdsRef.current = new Set();
          seenMainMessageKeysRef.current = new Set();
        }

        const agenciesFoundFallback = Array.isArray(pipeline.agencyIds)
          ? pipeline.agencyIds.length
          : agencies.length;

        setMainFound(
          typeof mainActivity?.agenciesFound === 'number' ? mainActivity.agenciesFound : agenciesFoundFallback
        );
        setMainTarget(
          typeof mainActivity?.agenciesTarget === 'number' ? mainActivity.agenciesTarget : requestedCount
        );

        const subagentActivityRaw =
          data.subagentActivity && typeof data.subagentActivity === 'object'
            ? (data.subagentActivity as Record<string, ActivityMessage[]>)
            : {};

        const nextSubagent = new Map<string, ActivityMessage[]>();
        const nextSeen = new Map<string, Set<string>>();
        const nextSeenKeys = new Map<string, Set<string>>();
        for (const [agencyId, messages] of Object.entries(subagentActivityRaw)) {
          if (!Array.isArray(messages)) continue;
          nextSubagent.set(agencyId, messages.slice(-250));
          nextSeen.set(agencyId, new Set(messages.map((m) => m.id)));
          nextSeenKeys.set(agencyId, new Set(messages.map(messageKey)));
        }
        setSubagentActivity(nextSubagent);
        seenSubagentMessageIdsRef.current = nextSeen;
        seenSubagentMessageKeysRef.current = nextSeenKeys;

        if (status === 'complete' || status === 'error' || status === 'cancelled') {
          const success = agencies.filter((a) => a.status === 'complete').length;
          const failed = agencies.filter((a) => a.status === 'error').length;
          setCompletionStats({ total: agencies.length, success, failed });
          clearActiveSessionId();
        }
      } catch (err) {
        console.error('Failed to rehydrate pipeline:', err);
        clearActiveSessionId();
      }
    })();
  }, [agencyCount, clearActiveSessionId, sessionId]);

  // SSE connection
  useEffect(() => {
    if (
      !sessionId ||
      pipelineStatus === 'idle' ||
      pipelineStatus === 'complete' ||
      pipelineStatus === 'error' ||
      pipelineStatus === 'cancelled'
    ) {
      return;
    }

    const eventSource = new EventSource(`/api/pipeline/stream?session=${sessionId}`);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case 'todo_update':
            setTodos(data.todos || []);
            if (data.status) {
              setPipelineStatus(data.status);
            }
            break;

          case 'card_update':
            setCards((prev) => {
              const next = new Map(prev);
              const incoming = data.data as AgencyProgress;

              next.set(data.agencyId, incoming);
              return next;
            });
            break;

          case 'card_remove':
            // Animate removal
            setRemovingCards((prev) => new Set(prev).add(data.agencyId));
            setTimeout(() => {
              setCards((prev) => {
                const next = new Map(prev);
                next.delete(data.agencyId);
                return next;
              });
              setRemovingCards((prev) => {
                const next = new Set(prev);
                next.delete(data.agencyId);
                return next;
              });
            }, 500);
            break;

          case 'main_activity_message':
            if (data?.message?.id && typeof data.message.id === 'string') {
              const seen = seenMainMessageIdsRef.current;
              const keys = seenMainMessageKeysRef.current;
              const key = messageKey(data.message);
              if (!seen.has(data.message.id) && !keys.has(key)) {
                seen.add(data.message.id);
                keys.add(key);
                // Prevent unbounded growth on long runs / reconnections.
                if (seen.size > 5000) {
                  seenMainMessageIdsRef.current = new Set(Array.from(seen).slice(-2000));
                }
                if (keys.size > 5000) {
                  seenMainMessageKeysRef.current = new Set(Array.from(keys).slice(-2000));
                }
                setMainActivityMessages((prev) => [...prev, data.message].slice(-400));
              }
            }
            setMainFound(data.found ?? 0);
            setMainTarget(data.target ?? 0);
            break;

          case 'subagent_activity_message':
            if (data?.message?.id && typeof data.message.id === 'string') {
              const agencyId = String(data.agencyId);
              const map = seenSubagentMessageIdsRef.current;
              const seen = map.get(agencyId) ?? new Set<string>();
              const keyMap = seenSubagentMessageKeysRef.current;
              const keys = keyMap.get(agencyId) ?? new Set<string>();
              const key = messageKey(data.message);
              if (!seen.has(data.message.id) && !keys.has(key)) {
                seen.add(data.message.id);
                keys.add(key);
                if (seen.size > 5000) {
                  map.set(agencyId, new Set(Array.from(seen).slice(-2000)));
                } else {
                  map.set(agencyId, seen);
                }
                if (keys.size > 5000) {
                  keyMap.set(agencyId, new Set(Array.from(keys).slice(-2000)));
                } else {
                  keyMap.set(agencyId, keys);
                }
                setSubagentActivity((prev) => {
                  const next = new Map(prev);
                  const existing = next.get(agencyId) ?? [];
                  next.set(agencyId, [...existing, data.message].slice(-250));
                  return next;
                });
              }
            }
            break;

          case 'pipeline_complete':
            setPipelineStatus(
              data.status === 'error'
                ? 'error'
                : data.status === 'cancelled'
                  ? 'cancelled'
                  : 'complete'
            );
            setCompletionStats({
              total: data.totalAgencies,
              success: data.successCount,
              failed: data.failedCount,
            });
            if (data.error) {
              setError(data.error);
            }
            clearActiveSessionId();
            eventSource.close();
            eventSourceRef.current = null;
            break;
        }
      } catch (err) {
        console.error('SSE parse error:', err);
      }
    };

    eventSource.onerror = () => {
      console.error('SSE connection error');
    };

    return () => {
      eventSource.close();
      if (eventSourceRef.current === eventSource) {
        eventSourceRef.current = null;
      }
    };
  }, [sessionId, pipelineStatus]);

  const handleSearch = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!suburb.trim()) return;

      // Reset state
      setError('');
      setCards(new Map());
      setTodos([
        { id: 'setup', text: 'Setting up workspace', status: 'complete' },
        { id: 'search', text: `Finding agencies in ${suburb.trim()}`, status: 'in_progress' },
        { id: 'spawn', text: `Starting ${agencyCount} parallel agency jobs`, status: 'pending' },
        { id: 'generate', text: 'Generating demo pages', status: 'pending' },
      ]);
      setCompletionStats(null);
      setRemovingCards(new Set());
      setPipelineStatus('searching');
      setActiveTab('search');
      // Reset activity state
      setMainActivityMessages([
        {
          id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
          type: 'thinking',
          text: `Preparing workspace for ${suburb.trim()}...`,
          source: 'System',
          timestamp: new Date().toISOString(),
        },
      ]);
      setMainFound(0);
      setMainTarget(agencyCount);
      setSubagentActivity(new Map());
      setCollapsedAgencyIds(new Set());
      resetSeenMessageCaches();

      try {
        const res = await fetch('/api/pipeline/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ suburb: suburb.trim(), count: agencyCount }),
        });

        const data = await res.json();
        if (data.success && data.sessionId) {
          setSessionId(data.sessionId);
          persistActiveSessionId(data.sessionId);
        } else {
          setError(data.error || 'Failed to start pipeline');
          setPipelineStatus('error');
          setCards(new Map());
          clearActiveSessionId();
        }
      } catch (err) {
        setError('Failed to start search. Please try again.');
        setPipelineStatus('error');
        setCards(new Map());
        clearActiveSessionId();
      }
    },
    [suburb, agencyCount, clearActiveSessionId, persistActiveSessionId]
  );

  const handleReset = () => {
    setSessionId(null);
    setPipelineStatus('idle');
    setCards(new Map());
    setTodos([]);
    setCompletionStats(null);
    setError('');
    setRemovingCards(new Set());
    // Reset activity state
    setMainActivityMessages([]);
    setMainFound(0);
    setMainTarget(0);
    setSubagentActivity(new Map());
    setCollapsedAgencyIds(new Set());
    resetSeenMessageCaches();
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
    callsEventSourceRef.current?.close();
    callsEventSourceRef.current = null;
    setCallsOpen(false);
    setCalls([]);
    setSelectedCallId(null);
    setCallsLoading(false);
    clearActiveSessionId();
  };

  const handleAgencyClick = (agencyId: string, demoUrl: string | null) => {
    if (demoUrl) {
      const normalized = demoUrl.endsWith('.html')
        ? demoUrl.replace(/\.html$/, '')
        : demoUrl;
      window.location.href = normalized;
    }
  };

  const handleCancelAll = async () => {
    if (!sessionId) return;
    try {
      await fetch('/api/pipeline/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
    } catch {
      // ignore
    } finally {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      setPipelineStatus('cancelled');
      clearActiveSessionId();
    }
  };

  const handleRename = async (sessionIdToRename: string, newName: string) => {
    try {
      const res = await fetch(`/api/history/${sessionIdToRename}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName }),
      });

      if (res.ok) {
        setHistory((prev) =>
          prev.map((s) =>
            s.sessionId === sessionIdToRename ? { ...s, name: newName } : s
          )
        );
      }
    } catch (err) {
      console.error('Failed to rename session:', err);
    }
  };

  const isSearching = pipelineStatus === 'searching' || pipelineStatus === 'processing';
  const cardsArray = Array.from(cards.values()).sort((a, b) => {
    // Sort by status: complete first, then generating, extracting, skeleton
    const statusOrder = { complete: 0, generating: 1, extracting: 2, skeleton: 3, error: 4 };
    return statusOrder[a.status] - statusOrder[b.status];
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      {/* Header */}
      <header className="border-b border-slate-700 bg-slate-900/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-white">Voqo</span>
              <span className="text-slate-400 text-sm">Lead Engine</span>
            </div>
            <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSettingsOpen(true)}
              className="p-2 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-slate-700/50"
              title="Settings"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </button>
            {pipelineStatus !== 'idle' && activeTab === 'search' && (
              <button
                onClick={handleReset}
                className="text-sm text-slate-400 hover:text-white transition-colors"
              >
                New Search
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Search Tab Content */}
      {activeTab === 'search' && (
        <>
          {/* Hero + Search */}
          <section className="py-12 md:py-16">
            <div className="max-w-4xl mx-auto px-4 text-center">
              <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
                Find Real Estate Agencies
              </h1>
              <p className="text-xl text-slate-300 mb-8">
                Search any suburb to discover agencies and generate personalized demos
              </p>

              <form onSubmit={handleSearch} className="max-w-2xl mx-auto space-y-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    value={suburb}
                    onChange={(e) => setSuburb(e.target.value)}
                    placeholder="Enter suburb (e.g. Surry Hills)"
                    disabled={isSearching}
                    className="flex-1 px-5 py-4 rounded-xl bg-white/10 border border-slate-600 text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={isSearching || !suburb.trim()}
                    className="px-8 py-4 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors"
                  >
                    {isSearching ? 'Searching...' : 'Search'}
                  </button>
                </div>

                {/* Agency count slider */}
                <div className="flex items-center gap-4 justify-center">
                  <label className="text-slate-400 text-sm">Agencies:</label>
                  <input
                    type="range"
                    min="1"
                    max="25"
                    value={agencyCount}
                    onChange={(e) => setAgencyCount(Number(e.target.value))}
                    disabled={isSearching}
                    className="w-32 accent-blue-500"
                  />
                  <span className="text-white font-medium w-8">{agencyCount}</span>
                </div>
              </form>

              {error && <p className="mt-4 text-red-400">{error}</p>}
            </div>
          </section>

          {(pipelineStatus !== 'idle' || todos.length > 0 || mainActivityMessages.length > 0) && (
            <section className="px-4 pb-6">
              <div className="max-w-6xl mx-auto sticky top-20 z-10">
                <MainAgentWorkspace
                  status={pipelineStatus}
                  todos={todos}
                  messages={mainActivityMessages.slice(-200)}
                  found={mainFound}
                  target={mainTarget}
                  onCancel={handleCancelAll}
                  canCancel={Boolean(sessionId) && (pipelineStatus === 'searching' || pipelineStatus === 'processing')}
                  callsOpen={callsOpen}
                  callsCount={calls.length}
                  onToggleCalls={() => {
                    setCallsOpen((prev) => {
                      const next = !prev;
                      if (!next) setSelectedCallId(null);
                      return next;
                    });
                  }}
                  callsPanel={
                    <CallsPanel
                      calls={calls}
                      loading={callsLoading}
                      selectedCallId={selectedCallId}
                      onSelectCall={(id) => {
                        setSelectedCallId(id);
                      }}
                      emptyState={
                        <span>
                          Calls appear here after someone dials the demo number from a generated page.
                        </span>
                      }
                    />
                  }
                />
              </div>
            </section>
          )}

          {/* Completion Stats */}
          {completionStats && pipelineStatus === 'complete' && (
            <section className="px-4 pb-6">
              <div className="max-w-6xl mx-auto">
                <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <svg
                      className="w-6 h-6 text-green-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span className="text-green-400 font-medium">
                      Pipeline complete! {completionStats.success} of {completionStats.total}{' '}
                      agencies processed successfully.
                    </span>
                  </div>
                  {completionStats.failed > 0 && (
                    <span className="text-amber-400 text-sm">
                      {completionStats.failed} failed
                    </span>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* Agency Cards Grid */}
          {cardsArray.length > 0 && (
            <section className="px-4 pb-16">
              <div className="max-w-6xl mx-auto">
                <h2 className="text-xl font-semibold text-white mb-4">
                  {isSearching ? 'Processing Agencies...' : `Found ${cardsArray.length} Agencies`}
                </h2>

                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {cardsArray.map((card) => (
                    <AgencyCard
                      key={card.agencyId}
                      data={card}
                      isRemoving={removingCards.has(card.agencyId)}
                      activity={subagentActivity.get(card.agencyId) ?? []}
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
              </div>
            </section>
          )}

          {/* Empty state during search */}
          {isSearching && cardsArray.length === 0 && mainActivityMessages.length === 0 && (
            <section className="px-4 py-12">
              <div className="max-w-6xl mx-auto text-center">
                <div className="inline-flex items-center gap-3 px-6 py-3 bg-slate-800 rounded-full">
                  <svg className="animate-spin h-5 w-5 text-blue-500" viewBox="0 0 24 24">
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
                  <span className="text-slate-300">Starting search for agencies in {suburb}...</span>
                </div>
              </div>
            </section>
          )}
        </>
      )}

      {/* History Tab Content */}
      {activeTab === 'history' && (
        <section className="py-8 px-4">
          <div className="max-w-6xl mx-auto">
            <h1 className="text-2xl font-bold text-white mb-6">Search History</h1>
            <HistoryList
              sessions={history}
              onAgencyClick={handleAgencyClick}
              onRename={handleRename}
              loading={historyLoading}
            />
          </div>
        </section>
      )}

      {/* Global Styles */}
      <style jsx global>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-5px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out forwards;
        }
        .activity-message {
          animation: fadeIn 0.2s ease-out;
        }
      `}</style>

      {selectedCallId && (
        <CallDetailModal
          callId={selectedCallId}
          onClose={() => setSelectedCallId(null)}
        />
      )}

      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}
