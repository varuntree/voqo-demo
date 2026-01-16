'use client';

import { useState } from 'react';

interface Todo {
  id: string;
  text: string;
  status: 'pending' | 'in_progress' | 'complete';
}

interface TodoPanelProps {
  todos: Todo[];
  pipelineStatus?: 'searching' | 'processing' | 'complete' | 'error';
}

export default function TodoPanel({ todos, pipelineStatus }: TodoPanelProps) {
  const [collapsed, setCollapsed] = useState(false);

  const completedCount = todos.filter((t) => t.status === 'complete').length;
  const totalCount = todos.length;

  const getStatusIcon = (status: Todo['status']) => {
    switch (status) {
      case 'pending':
        return (
          <span className="text-slate-500">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <circle cx="12" cy="12" r="9" strokeWidth="2" />
            </svg>
          </span>
        );
      case 'in_progress':
        return (
          <span className="text-blue-500">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          </span>
        );
      case 'complete':
        return (
          <span className="text-green-500">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
          </span>
        );
    }
  };

  const getStatusText = (status: Todo['status']) => {
    switch (status) {
      case 'pending':
        return 'text-slate-500';
      case 'in_progress':
        return 'text-blue-400';
      case 'complete':
        return 'text-green-400';
    }
  };

  const getPipelineStatusBadge = () => {
    switch (pipelineStatus) {
      case 'searching':
        return (
          <span className="px-2 py-0.5 text-xs bg-blue-500/20 text-blue-400 rounded-full">
            Searching
          </span>
        );
      case 'processing':
        return (
          <span className="px-2 py-0.5 text-xs bg-amber-500/20 text-amber-400 rounded-full">
            Processing
          </span>
        );
      case 'complete':
        return (
          <span className="px-2 py-0.5 text-xs bg-green-500/20 text-green-400 rounded-full">
            Complete
          </span>
        );
      case 'error':
        return (
          <span className="px-2 py-0.5 text-xs bg-red-500/20 text-red-400 rounded-full">
            Error
          </span>
        );
      default:
        return null;
    }
  };

  if (todos.length === 0) return null;

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden backdrop-blur">
      {/* Header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-700/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-slate-400 font-medium">Agent Tasks</span>
          <span className="text-xs text-slate-500">
            {completedCount}/{totalCount}
          </span>
          {getPipelineStatusBadge()}
        </div>
        <svg
          className={`w-5 h-5 text-slate-500 transition-transform ${collapsed ? '' : 'rotate-180'}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Content */}
      <div
        className={`transition-all duration-300 ease-in-out overflow-hidden ${
          collapsed ? 'max-h-0' : 'max-h-96'
        }`}
      >
        <div className="px-4 pb-3 space-y-2">
          {todos.map((todo) => (
            <div
              key={todo.id}
              className={`flex items-center gap-3 py-1.5 transition-all duration-300 ${
                todo.status === 'complete' ? 'opacity-60' : ''
              }`}
            >
              {getStatusIcon(todo.status)}
              <span
                className={`text-sm transition-colors ${getStatusText(todo.status)} ${
                  todo.status === 'complete' ? 'line-through' : ''
                }`}
              >
                {todo.text}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
