'use client';

import { useState } from 'react';
import Link from 'next/link';
import { SearchSession } from '@/lib/types';

interface HistoryCardProps {
  session: SearchSession;
  onAgencyClick: (agencyId: string, demoUrl: string | null) => void;
  onRename: (newName: string) => void;
}

export default function HistoryCard({ session, onAgencyClick, onRename }: HistoryCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(session.name);

  const handleSave = () => {
    if (editName.trim() && editName !== session.name) {
      onRename(editName.trim());
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setEditName(session.name);
      setIsEditing(false);
    }
  };

  const getStatusBadge = () => {
    switch (session.status) {
      case 'running':
        return (
          <span className="px-2 py-0.5 text-xs bg-blue-500/20 text-blue-400 rounded-full">
            Running
          </span>
        );
      case 'complete':
        return (
          <span className="px-2 py-0.5 text-xs bg-green-500/20 text-green-400 rounded-full">
            Complete
          </span>
        );
      case 'partial':
        return (
          <span className="px-2 py-0.5 text-xs bg-amber-500/20 text-amber-400 rounded-full">
            Partial
          </span>
        );
      case 'failed':
        return (
          <span className="px-2 py-0.5 text-xs bg-red-500/20 text-red-400 rounded-full">
            Failed
          </span>
        );
    }
  };

  const visibleAgencies = session.agencies.slice(0, 5);
  const remainingCount = session.agencies.length - 5;

  return (
    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 hover:border-slate-600 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleSave}
              onKeyDown={handleKeyDown}
              autoFocus
              className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          ) : (
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-white truncate">{session.name}</h3>
              <button
                onClick={() => setIsEditing(true)}
                className="text-slate-500 hover:text-slate-300 transition-colors flex-shrink-0"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                  />
                </svg>
              </button>
            </div>
          )}
        </div>
        {getStatusBadge()}
      </div>

      {/* Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
        <p className="text-sm text-slate-400">
          {session.actualCount} agencies • {session.successCount} demos generated
        </p>
        <Link
          href={`/history/${session.sessionId}`}
          className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
        >
          View run →
        </Link>
      </div>

      {/* Agency Chips */}
      <div className="flex flex-wrap gap-2">
        {visibleAgencies.map((agency) => (
          <button
            key={agency.id}
            onClick={() => onAgencyClick(agency.id, agency.demoUrl)}
            disabled={!agency.demoUrl}
            className={`
              flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all
              ${
                agency.demoUrl
                  ? 'bg-slate-700 hover:bg-slate-600 text-white cursor-pointer'
                  : 'bg-slate-700/50 text-slate-500 cursor-not-allowed'
              }
            `}
            title={agency.demoUrl ? 'View demo' : 'Demo not generated'}
          >
            {agency.logoUrl ? (
              <img
                src={agency.logoUrl}
                alt=""
                className="w-4 h-4 object-contain rounded"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <span className="w-4 h-4 bg-slate-600 rounded flex items-center justify-center text-[10px]">
                {agency.name.charAt(0)}
              </span>
            )}
            <span className="truncate max-w-[80px]">{agency.name}</span>
          </button>
        ))}
        {remainingCount > 0 && (
          <span className="px-3 py-1.5 bg-slate-700/50 rounded-lg text-xs text-slate-400">
            +{remainingCount} more
          </span>
        )}
      </div>

      {/* Hint */}
      <p className="text-xs text-slate-500 mt-3">Click any agency to view their demo page</p>
    </div>
  );
}
