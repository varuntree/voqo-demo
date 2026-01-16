'use client';

import { useEffect, useRef } from 'react';
import { ActivityMessage as ActivityMessageType } from '@/lib/types';
import ActivityMessage from './ActivityMessage';

interface AgentActivityPanelProps {
  status: 'active' | 'complete' | 'collapsed';
  messages: ActivityMessageType[];
  found: number;
  target: number;
  onToggle: () => void;
}

export default function AgentActivityPanel({
  status,
  messages,
  found,
  target,
  onToggle,
}: AgentActivityPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current && status === 'active') {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, status]);

  // Collapsed state
  if (status === 'collapsed') {
    return (
      <div
        onClick={onToggle}
        className="bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 cursor-pointer hover:bg-slate-800/70 transition-colors"
      >
        <div className="flex items-center gap-3 text-sm">
          <span className="text-slate-400">▶</span>
          <span className="text-slate-300 font-medium">Agent Activity</span>
          <span className="text-slate-500">•</span>
          <span className="text-green-400">{found} agencies found</span>
          <span className="text-slate-500 ml-auto">Click to expand</span>
        </div>
      </div>
    );
  }

  // Active or Expanded state
  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
      {/* Header */}
      <div
        onClick={status === 'complete' ? onToggle : undefined}
        className={`px-4 py-3 border-b border-slate-700 flex items-center justify-between ${
          status === 'complete' ? 'cursor-pointer hover:bg-slate-800/70' : ''
        }`}
      >
        <div className="flex items-center gap-3">
          <span className="text-slate-400">{status === 'complete' ? '▼' : ''}</span>
          <span className="text-slate-300 font-medium">Agent Activity</span>
          {status === 'complete' && (
            <>
              <span className="text-slate-500">•</span>
              <span className="text-green-400">{found} agencies found</span>
            </>
          )}
        </div>
        {status === 'active' && (
          <span className="text-slate-400 text-sm">
            Found {found} of {target} agencies
          </span>
        )}
      </div>

      {/* Messages area */}
      <div
        ref={scrollRef}
        className="px-4 py-3 max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-transparent"
      >
        {messages.length === 0 ? (
          <p className="text-slate-500 text-sm">Starting search...</p>
        ) : (
          messages.map((msg) => <ActivityMessage key={msg.id} message={msg} />)
        )}

        {/* Streaming indicator */}
        {status === 'active' && (
          <div className="flex items-center gap-1 py-2">
            <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
            <span
              className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse"
              style={{ animationDelay: '0.2s' }}
            />
            <span
              className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse"
              style={{ animationDelay: '0.4s' }}
            />
          </div>
        )}
      </div>

      {/* Footer with progress */}
      {status === 'active' && (
        <div className="px-4 py-2 border-t border-slate-700 bg-slate-800/30">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">
              Found {found} of {target} agencies
            </span>
            <div className="w-32 h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-300"
                style={{ width: `${target > 0 ? (found / target) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
