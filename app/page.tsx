'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import TodoPanel from '@/components/TodoPanel';
import AgencyCard from '@/components/AgencyCard';
import TabNavigation from '@/components/TabNavigation';
import HistoryList from '@/components/HistoryList';
import AgentActivityPanel from '@/components/AgentActivityPanel';
import { AgencyProgress, SearchSession, ActivityMessage } from '@/lib/types';

interface Todo {
  id: string;
  text: string;
  status: 'pending' | 'in_progress' | 'complete';
}

type PipelineStatus = 'idle' | 'searching' | 'processing' | 'complete' | 'error';

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
  const placeholderIdsRef = useRef<Set<string>>(new Set());
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
  const [activityMessages, setActivityMessages] = useState<ActivityMessage[]>([]);
  const [activityFound, setActivityFound] = useState(0);
  const [activityTarget, setActivityTarget] = useState(0);
  const [activityPanelStatus, setActivityPanelStatus] = useState<'active' | 'complete' | 'collapsed'>('active');

  // Load history when tab changes to history
  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory();
    }
  }, [activeTab]);

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

  const buildPlaceholderCards = useCallback((count: number) => {
    const now = new Date().toISOString();
    const placeholders = new Map<string, AgencyProgress>();
    const ids = new Set<string>();

    for (let i = 0; i < count; i += 1) {
      const id = `placeholder-${Date.now()}-${i}`;
      ids.add(id);
      placeholders.set(id, {
        agencyId: id,
        sessionId: 'pending',
        isPlaceholder: true,
        status: 'skeleton',
        updatedAt: now,
        name: null,
        website: null,
        phone: null,
        address: null,
        logoUrl: null,
        primaryColor: null,
        secondaryColor: null,
        teamSize: null,
        listingCount: null,
        painScore: null,
        soldCount: null,
        priceRangeMin: null,
        priceRangeMax: null,
        forRentCount: null,
        htmlProgress: 0,
        demoUrl: null,
      });
    }

    return { placeholders, ids };
  }, []);

  // SSE connection
  useEffect(() => {
    if (!sessionId || pipelineStatus === 'idle' || pipelineStatus === 'complete') {
      return;
    }

    const eventSource = new EventSource(`/api/pipeline/stream?session=${sessionId}`);

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

              if (!incoming.isPlaceholder && placeholderIdsRef.current.size > 0) {
                for (const id of placeholderIdsRef.current) {
                  next.delete(id);
                }
                placeholderIdsRef.current = new Set();
              }

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

          case 'activity_message':
            setActivityMessages((prev) => [...prev, data.message]);
            setActivityFound(data.found);
            setActivityTarget(data.target);
            break;

          case 'activity_complete':
            setActivityFound(data.found);
            setActivityTarget(data.target);
            setActivityPanelStatus('complete');
            break;

          case 'pipeline_complete':
            setPipelineStatus(data.status === 'error' ? 'error' : 'complete');
            setCompletionStats({
              total: data.totalAgencies,
              success: data.successCount,
              failed: data.failedCount,
            });
            setActivityPanelStatus('complete');
            if (data.error) {
              setError(data.error);
            }
            eventSource.close();
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
    };
  }, [sessionId, pipelineStatus]);

  const handleSearch = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!suburb.trim()) return;

      // Reset state
      setError('');
      setCards(new Map());
      setTodos([]);
      setCompletionStats(null);
      setRemovingCards(new Set());
      setPipelineStatus('searching');
      setActiveTab('search');
      // Reset activity state
      setActivityMessages([]);
      setActivityFound(0);
      setActivityTarget(agencyCount);
      setActivityPanelStatus('active');

      const { placeholders, ids } = buildPlaceholderCards(agencyCount);
      setCards(placeholders);
      placeholderIdsRef.current = ids;

      try {
        const res = await fetch('/api/pipeline/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ suburb: suburb.trim(), count: agencyCount }),
        });

        const data = await res.json();
        if (data.success && data.sessionId) {
          setSessionId(data.sessionId);
        } else {
          setError(data.error || 'Failed to start pipeline');
          setPipelineStatus('error');
          setCards(new Map());
          placeholderIdsRef.current = new Set();
        }
      } catch (err) {
        setError('Failed to start search. Please try again.');
        setPipelineStatus('error');
        setCards(new Map());
        placeholderIdsRef.current = new Set();
      }
    },
    [suburb, agencyCount, buildPlaceholderCards]
  );

  const handleReset = () => {
    setSessionId(null);
    setPipelineStatus('idle');
    setCards(new Map());
    setTodos([]);
    setCompletionStats(null);
    setError('');
    setRemovingCards(new Set());
    placeholderIdsRef.current = new Set();
    // Reset activity state
    setActivityMessages([]);
    setActivityFound(0);
    setActivityTarget(0);
    setActivityPanelStatus('active');
  };

  const handleAgencyClick = (agencyId: string, demoUrl: string | null) => {
    if (demoUrl) {
      const normalized = demoUrl.endsWith('.html')
        ? demoUrl.replace(/\.html$/, '')
        : demoUrl;
      window.location.href = normalized;
    }
  };

  const handleActivityPanelToggle = () => {
    setActivityPanelStatus((prev) =>
      prev === 'collapsed' ? 'complete' : 'collapsed'
    );
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
          {pipelineStatus !== 'idle' && activeTab === 'search' && (
            <button
              onClick={handleReset}
              className="text-sm text-slate-400 hover:text-white transition-colors"
            >
              New Search
            </button>
          )}
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

          {/* Todo Panel */}
          {todos.length > 0 && (
            <section className="px-4 pb-6">
              <div className="max-w-6xl mx-auto">
                <TodoPanel
                  todos={todos}
                  pipelineStatus={
                    pipelineStatus as 'searching' | 'processing' | 'complete' | 'error'
                  }
                />
              </div>
            </section>
          )}

          {/* Agent Activity Panel */}
          {(pipelineStatus === 'searching' || pipelineStatus === 'processing') && (
            <section className="px-4 pb-6">
              <div className="max-w-6xl mx-auto">
                <AgentActivityPanel
                  status={activityPanelStatus}
                  messages={activityMessages}
                  found={activityFound}
                  target={activityTarget}
                  onToggle={handleActivityPanelToggle}
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
                    />
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Empty state during search - only show if no activity panel */}
          {isSearching && cardsArray.length === 0 && activityMessages.length === 0 && (
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
    </div>
  );
}
