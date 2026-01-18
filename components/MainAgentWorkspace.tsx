'use client';

import { useEffect, useRef, useState } from 'react';
import type { ActivityMessage, PipelineState } from '@/lib/types';
import ActivityMessageRow from '@/components/ActivityMessage';

type Todo = PipelineState['todos'][number];

interface MainAgentWorkspaceProps {
  status: PipelineState['status'] | 'idle';
  todos: Todo[];
  messages: ActivityMessage[];
  found: number;
  target: number;
  onCancel: () => void;
  canCancel: boolean;
  callsOpen?: boolean;
  callsCount?: number;
  onToggleCalls?: () => void;
  callsPanel?: React.ReactNode;
}

function StatusBadge({ status }: { status: MainAgentWorkspaceProps['status'] }) {
  switch (status) {
    case 'searching':
      return <span className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-widest bg-[#00C853]/10 text-[#00C853] rounded-full">Searching</span>;
    case 'processing':
      return <span className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-widest bg-amber-50 text-amber-700 rounded-full">Processing</span>;
    case 'complete':
      return <span className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-widest bg-emerald-50 text-emerald-700 rounded-full">Complete</span>;
    case 'cancelled':
      return <span className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-widest bg-stone-100 text-stone-500 rounded-full">Cancelled</span>;
    case 'error':
      return <span className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-widest bg-red-50 text-red-600 rounded-full">Error</span>;
    default:
      return null;
  }
}

function TodoRow({ todo }: { todo: Todo }) {
  const base = 'w-4 h-4';
  const icon = (() => {
    switch (todo.status) {
      case 'pending':
        return (
          <svg className={base} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <circle cx="12" cy="12" r="9" strokeWidth="2" />
          </svg>
        );
      case 'in_progress':
        return (
          <svg className={`${base} animate-spin`} fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        );
      case 'complete':
        return (
          <svg className={base} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
        );
    }
  })();

  const color =
    todo.status === 'complete'
      ? 'text-emerald-600'
      : todo.status === 'in_progress'
        ? 'text-[#00C853]'
        : 'text-stone-400';

  return (
    <div className={`flex items-start gap-3 py-1.5 ${todo.status === 'complete' ? 'opacity-70' : ''}`}>
      <span className={color}>{icon}</span>
      <span
        className={`text-sm ${
          todo.status === 'complete' ? 'text-stone-400 line-through' : todo.status === 'in_progress' ? 'text-stone-700' : 'text-stone-500'
        }`}
      >
        {todo.text}
      </span>
    </div>
  );
}

export default function MainAgentWorkspace({
  status,
  todos,
  messages,
  found,
  target,
  onCancel,
  canCancel,
  callsOpen,
  callsCount,
  onToggleCalls,
  callsPanel,
}: MainAgentWorkspaceProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length]);

  const running = status === 'searching' || status === 'processing';
  const completedCount = todos.filter((t) => t.status === 'complete').length;
  const showCalls = Boolean(callsOpen && callsPanel);

  return (
    <div className="bg-white border-2 border-stone-100 rounded-3xl overflow-hidden shadow-sm">
      <div className="px-6 py-5 border-b border-stone-100 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h2 className="text-stone-900 font-semibold truncate">Engine Workspace</h2>
            <StatusBadge status={status} />
            <span className="text-stone-300 text-sm">•</span>
            <span className="text-stone-600 text-sm font-mono">
              {found}/{target} agencies identified
            </span>
          </div>
          <p className="text-stone-500 text-sm mt-0.5">
            {running ? 'Streaming updates in real time.' : status === 'idle' ? 'Ready when you are.' : 'Run finished.'}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {todos.length > 0 && (
            <span className="text-xs text-stone-400 font-mono">
              {completedCount}/{todos.length}
            </span>
          )}
          {onToggleCalls && (
            <button
              onClick={onToggleCalls}
              className="text-xs text-stone-500 hover:text-stone-900 transition-colors font-mono uppercase tracking-wider"
              type="button"
            >
              Calls{typeof callsCount === 'number' ? ` (${callsCount})` : ''}
            </button>
          )}
          <button
            onClick={() => setCollapsed((prev) => !prev)}
            className="text-xs text-stone-500 hover:text-stone-900 transition-colors font-mono uppercase tracking-wider"
            type="button"
          >
            {collapsed ? 'Expand' : 'Collapse'}
          </button>
          <button
            onClick={onCancel}
            disabled={!canCancel}
            className="px-4 py-2 text-xs font-mono uppercase tracking-widest rounded-full bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            type="button"
          >
            Cancel
          </button>
        </div>
      </div>

      <div
        className={`${collapsed ? 'hidden' : 'grid'} grid-cols-1 lg:grid-cols-7`}
      >
        <div
          className={`px-6 py-5 border-b lg:border-b-0 border-stone-100 ${
            showCalls ? 'lg:col-span-3 lg:border-r' : 'lg:col-span-4 lg:border-r'
          }`}
        >
          <div
            ref={scrollRef}
            className="max-h-72 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-stone-300 scrollbar-track-transparent"
          >
            {messages.length === 0 ? (
              <p className="text-stone-500 text-sm">Waiting for activity…</p>
            ) : (
              messages.map((msg) => <ActivityMessageRow key={msg.id} message={msg} />)
            )}
          </div>

          {running && (
            <div className="mt-3 flex items-center gap-2 text-xs text-stone-500">
              <span className="w-1.5 h-1.5 bg-[#00C853] rounded-full animate-pulse" />
              <span className="w-1.5 h-1.5 bg-[#00C853] rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
              <span className="w-1.5 h-1.5 bg-[#00C853] rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
              <span className="font-mono uppercase tracking-wider">Live stream</span>
            </div>
          )}
        </div>

        <div className={`px-6 py-5 ${showCalls ? 'lg:col-span-2 lg:border-r border-stone-100' : 'lg:col-span-3'}`}>
          {todos.length === 0 ? (
            <p className="text-stone-500 text-sm">No tasks yet.</p>
          ) : (
            <div>
              <h3 className="text-stone-600 font-medium text-sm mb-2">Tasks</h3>
              <div className="space-y-1">
                {todos.map((todo) => (
                  <TodoRow key={todo.id} todo={todo} />
                ))}
              </div>
            </div>
          )}
        </div>

        {showCalls && (
          <div className="px-6 py-5 lg:col-span-2">
            <h3 className="text-stone-600 font-medium text-sm mb-2">Calls</h3>
            {callsPanel}
          </div>
        )}
      </div>
    </div>
  );
}
