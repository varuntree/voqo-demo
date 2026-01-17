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
}

function StatusBadge({ status }: { status: MainAgentWorkspaceProps['status'] }) {
  switch (status) {
    case 'searching':
      return <span className="px-2 py-0.5 text-xs bg-blue-500/20 text-blue-300 rounded-full">Searching</span>;
    case 'processing':
      return <span className="px-2 py-0.5 text-xs bg-amber-500/20 text-amber-300 rounded-full">Processing</span>;
    case 'complete':
      return <span className="px-2 py-0.5 text-xs bg-green-500/20 text-green-300 rounded-full">Complete</span>;
    case 'cancelled':
      return <span className="px-2 py-0.5 text-xs bg-slate-500/20 text-slate-300 rounded-full">Cancelled</span>;
    case 'error':
      return <span className="px-2 py-0.5 text-xs bg-red-500/20 text-red-300 rounded-full">Error</span>;
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
      ? 'text-green-300'
      : todo.status === 'in_progress'
        ? 'text-blue-300'
        : 'text-slate-500';

  return (
    <div className={`flex items-start gap-3 py-1.5 ${todo.status === 'complete' ? 'opacity-70' : ''}`}>
      <span className={color}>{icon}</span>
      <span
        className={`text-sm ${
          todo.status === 'complete' ? 'text-slate-400 line-through' : todo.status === 'in_progress' ? 'text-slate-200' : 'text-slate-500'
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
}: MainAgentWorkspaceProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length]);

  const running = status === 'searching' || status === 'processing';
  const completedCount = todos.filter((t) => t.status === 'complete').length;

  return (
    <div className="bg-slate-900/40 border border-slate-700 rounded-2xl overflow-hidden backdrop-blur">
      <div className="px-5 py-4 border-b border-slate-700 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h2 className="text-white font-semibold truncate">Engine Workspace</h2>
            <StatusBadge status={status} />
            <span className="text-slate-500 text-sm">•</span>
            <span className="text-slate-300 text-sm">
              {found}/{target} agencies identified
            </span>
          </div>
          <p className="text-slate-500 text-sm mt-0.5">
            {running ? 'Streaming updates in real time.' : status === 'idle' ? 'Ready when you are.' : 'Run finished.'}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {todos.length > 0 && (
            <span className="text-xs text-slate-500">
              {completedCount}/{todos.length}
            </span>
          )}
          <button
            onClick={() => setCollapsed((prev) => !prev)}
            className="text-xs text-slate-400 hover:text-white transition-colors"
            type="button"
          >
            {collapsed ? 'Expand' : 'Collapse'}
          </button>
          <button
            onClick={onCancel}
            disabled={!canCancel}
            className="px-3 py-1.5 text-sm rounded-lg bg-red-500/20 text-red-200 hover:bg-red-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            type="button"
          >
            Cancel All
          </button>
        </div>
      </div>

      <div className={`${collapsed ? 'hidden' : 'grid'} grid-cols-1 lg:grid-cols-5`}>
        <div className="lg:col-span-3 px-5 py-4 border-b lg:border-b-0 lg:border-r border-slate-700">
          <div
            ref={scrollRef}
            className="max-h-72 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-transparent"
          >
            {messages.length === 0 ? (
              <p className="text-slate-500 text-sm">Waiting for activity…</p>
            ) : (
              messages.map((msg) => <ActivityMessageRow key={msg.id} message={msg} />)
            )}
          </div>

          {running && (
            <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
              <span className="w-1.5 h-1.5 bg-blue-300 rounded-full animate-pulse" />
              <span className="w-1.5 h-1.5 bg-blue-300 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
              <span className="w-1.5 h-1.5 bg-blue-300 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
              <span>Live stream</span>
            </div>
          )}
        </div>

        <div className="lg:col-span-2 px-5 py-4">
          {todos.length === 0 ? (
            <p className="text-slate-500 text-sm">No tasks yet.</p>
          ) : (
            <div>
              <h3 className="text-slate-300 font-medium text-sm mb-2">Tasks</h3>
              <div className="space-y-1">
                {todos.map((todo) => (
                  <TodoRow key={todo.id} todo={todo} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

