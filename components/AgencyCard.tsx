'use client';

import MockPreview from './MockPreview';

export interface AgencyProgress {
  agencyId: string;
  sessionId: string;
  status: 'skeleton' | 'extracting' | 'generating' | 'complete' | 'error';
  updatedAt: string;
  name: string | null;
  website: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  phone: string | null;
  teamSize: number | null;
  listingCount: number | null;
  painScore: number | null;
  htmlProgress: number;
  demoUrl: string | null;
  error?: string;
}

interface AgencyCardProps {
  data: AgencyProgress;
  isRemoving?: boolean;
}

export default function AgencyCard({ data, isRemoving }: AgencyCardProps) {
  const getPainScoreColor = (score: number | null) => {
    if (score === null) return 'bg-slate-700 text-slate-400';
    if (score >= 70) return 'bg-red-500/20 text-red-400';
    if (score >= 40) return 'bg-amber-500/20 text-amber-400';
    return 'bg-green-500/20 text-green-400';
  };

  const getStatusBadge = () => {
    switch (data.status) {
      case 'skeleton':
        return (
          <span className="px-2 py-0.5 text-xs bg-slate-600 text-slate-300 rounded-full animate-pulse">
            Queued
          </span>
        );
      case 'extracting':
        return (
          <span className="px-2 py-0.5 text-xs bg-blue-500/20 text-blue-400 rounded-full">
            Extracting...
          </span>
        );
      case 'generating':
        return (
          <span className="px-2 py-0.5 text-xs bg-amber-500/20 text-amber-400 rounded-full">
            Generating...
          </span>
        );
      case 'complete':
        return (
          <span className="px-2 py-0.5 text-xs bg-green-500/20 text-green-400 rounded-full">
            Ready
          </span>
        );
      case 'error':
        return (
          <span className="px-2 py-0.5 text-xs bg-red-500/20 text-red-400 rounded-full">
            Failed
          </span>
        );
    }
  };

  const borderColor = data.primaryColor || '#475569'; // slate-600 fallback

  return (
    <div
      className={`
        bg-slate-800 rounded-xl overflow-hidden transition-all duration-500
        ${isRemoving ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}
        ${data.status === 'skeleton' ? 'animate-pulse' : ''}
      `}
      style={{
        borderWidth: '2px',
        borderStyle: 'solid',
        borderColor: data.status !== 'skeleton' ? borderColor : '#475569',
      }}
    >
      {/* Header */}
      <div className="p-4 border-b border-slate-700/50">
        <div className="flex items-start justify-between gap-3">
          {/* Logo + Name */}
          <div className="flex items-center gap-3 min-w-0">
            {data.logoUrl ? (
              <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                <img
                  src={data.logoUrl}
                  alt={data.name || 'Agency'}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center flex-shrink-0">
                <span className="text-slate-500 text-lg font-bold">
                  {data.name?.charAt(0) || '?'}
                </span>
              </div>
            )}
            <div className="min-w-0">
              <h3 className="font-semibold text-white truncate">
                {data.name || 'Loading...'}
              </h3>
              {data.website && (
                <a
                  href={data.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-slate-500 hover:text-slate-400 truncate block"
                >
                  {new URL(data.website).hostname}
                </a>
              )}
            </div>
          </div>

          {/* Status Badge */}
          {getStatusBadge()}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Skeleton state */}
        {data.status === 'skeleton' && (
          <div className="space-y-3">
            <div className="h-4 bg-slate-700 rounded w-3/4 animate-pulse" />
            <div className="h-4 bg-slate-700 rounded w-1/2 animate-pulse" />
            <div className="h-8 bg-slate-700 rounded w-full animate-pulse mt-4" />
          </div>
        )}

        {/* Extracting state */}
        {data.status === 'extracting' && (
          <div className="space-y-3">
            {/* Progressive data reveal */}
            {data.phone && (
              <div className="flex items-center gap-2 text-sm animate-fadeIn">
                <span className="text-slate-500">Phone:</span>
                <span className="text-slate-300">{data.phone}</span>
              </div>
            )}
            {data.teamSize !== null && (
              <div className="flex items-center gap-2 text-sm animate-fadeIn">
                <span className="text-slate-500">Team:</span>
                <span className="text-slate-300">{data.teamSize} agents</span>
              </div>
            )}
            {data.listingCount !== null && (
              <div className="flex items-center gap-2 text-sm animate-fadeIn">
                <span className="text-slate-500">Listings:</span>
                <span className="text-slate-300">{data.listingCount}</span>
              </div>
            )}

            {/* Loading indicator */}
            <div className="flex items-center gap-2 text-sm text-blue-400 mt-3">
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
              <span>Extracting details...</span>
            </div>
          </div>
        )}

        {/* Generating state */}
        {data.status === 'generating' && (
          <div className="space-y-3">
            {/* Metrics row */}
            <div className="flex flex-wrap gap-2">
              {data.listingCount !== null && (
                <span className="px-2 py-1 bg-slate-700 rounded text-xs text-slate-300">
                  {data.listingCount} listings
                </span>
              )}
              {data.teamSize !== null && (
                <span className="px-2 py-1 bg-slate-700 rounded text-xs text-slate-300">
                  {data.teamSize} agents
                </span>
              )}
              {data.painScore !== null && (
                <span
                  className={`px-2 py-1 rounded text-xs font-medium ${getPainScoreColor(
                    data.painScore
                  )}`}
                >
                  Pain: {data.painScore}
                </span>
              )}
            </div>

            {/* Mock Preview */}
            <MockPreview
              primaryColor={data.primaryColor}
              progress={data.htmlProgress}
            />

            {/* Progress bar */}
            <div className="mt-2">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span>Generating page...</span>
                <span>{data.htmlProgress}%</span>
              </div>
              <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-500"
                  style={{ width: `${data.htmlProgress}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Complete state */}
        {data.status === 'complete' && (
          <div className="space-y-3">
            {/* Metrics row */}
            <div className="flex flex-wrap gap-2">
              {data.listingCount !== null && (
                <span className="px-2 py-1 bg-slate-700 rounded text-xs text-slate-300">
                  {data.listingCount} listings
                </span>
              )}
              {data.teamSize !== null && (
                <span className="px-2 py-1 bg-slate-700 rounded text-xs text-slate-300">
                  {data.teamSize} agents
                </span>
              )}
              {data.painScore !== null && (
                <span
                  className={`px-2 py-1 rounded text-xs font-medium ${getPainScoreColor(
                    data.painScore
                  )}`}
                >
                  Pain: {data.painScore}
                </span>
              )}
            </div>

            {/* View Demo button */}
            {data.demoUrl && (
              <a
                href={data.demoUrl}
                className="block w-full py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-medium rounded-lg text-center transition-all"
              >
                View Demo
              </a>
            )}
          </div>
        )}

        {/* Error state */}
        {data.status === 'error' && (
          <div className="text-center py-2">
            <p className="text-red-400 text-sm">{data.error || 'Failed to process'}</p>
          </div>
        )}
      </div>
    </div>
  );
}
