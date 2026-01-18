'use client';

import { SearchSession } from '@/lib/types';
import HistoryCard from './HistoryCard';

interface HistoryListProps {
  sessions: SearchSession[];
  onAgencyClick: (agencyId: string, demoUrl: string | null) => void;
  onRename: (sessionId: string, newName: string) => void;
  loading?: boolean;
}

export default function HistoryList({
  sessions,
  onAgencyClick,
  onRename,
  loading,
}: HistoryListProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-3">
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
          <span className="text-stone-500 font-mono text-sm">Loading history...</span>
        </div>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 mx-auto mb-4 bg-stone-100 rounded-full flex items-center justify-center">
          <svg
            className="w-8 h-8 text-stone-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-stone-900 mb-2">No searches yet</h3>
        <p className="text-stone-500">
          Start by searching for agencies in a suburb.
          <br />
          Your search history will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sessions.map((session) => (
        <HistoryCard
          key={session.sessionId}
          session={session}
          onAgencyClick={onAgencyClick}
          onRename={(newName) => onRename(session.sessionId, newName)}
        />
      ))}
    </div>
  );
}
