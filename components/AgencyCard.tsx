'use client';

import { AgencyProgress, ActivityMessage, CardStep } from '@/lib/types';
import StepList from './StepList';
import ShimmerPreview from './ShimmerPreview';
import ActivityMessageRow from './ActivityMessage';

interface AgencyCardProps {
  data: AgencyProgress;
  isRemoving?: boolean;
  activity?: ActivityMessage[];
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

function MiniTodos({ status }: { status: AgencyProgress['status'] }) {
  const extract =
    status === 'skeleton' ? 'pending' : status === 'extracting' ? 'in_progress' : 'complete';
  const generate =
    status === 'generating' ? 'in_progress' : status === 'complete' ? 'complete' : status === 'error' ? 'pending' : 'pending';

  const Row = ({
    label,
    state,
  }: {
    label: string;
    state: 'pending' | 'in_progress' | 'complete';
  }) => {
    const icon = (() => {
      if (state === 'complete') {
        return (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
        );
      }
      if (state === 'in_progress') {
        return (
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        );
      }
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <circle cx="12" cy="12" r="9" strokeWidth="2" />
        </svg>
      );
    })();

    const color =
      state === 'complete'
        ? 'text-green-300'
        : state === 'in_progress'
          ? 'text-blue-300'
          : 'text-slate-500';

    return (
      <div className="flex items-center gap-2 text-xs">
        <span className={color}>{icon}</span>
        <span className={state === 'pending' ? 'text-slate-500' : 'text-slate-300'}>{label}</span>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-2 gap-2">
      <Row label="Extract info" state={extract} />
      <Row label="Generate page" state={generate} />
    </div>
  );
}

export default function AgencyCard({
  data,
  isRemoving,
  activity = [],
  isExpanded = false,
  onToggleExpand,
}: AgencyCardProps) {
  // Note: getPainScoreColor removed 2026-01-18 (painScore field deprecated)

  const borderColor = data.primaryColor || '#475569'; // slate-600 fallback
  const normalizeDemoUrl = (demoUrl: string | null) => {
    if (!demoUrl) return null;
    if (demoUrl.startsWith('/demo/') && demoUrl.endsWith('.html')) {
      return demoUrl.replace(/\.html$/, '');
    }
    return demoUrl;
  };

  const getFallbackLogo = (website: string | null) => {
    if (!website) return null;
    try {
      const hostname = new URL(website).hostname;
      return `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`;
    } catch {
      return null;
    }
  };

  const buildSteps = (progress: AgencyProgress): CardStep[] => {
    const steps: CardStep[] = [
      { id: 'website', label: 'Found website', status: 'pending' },
      { id: 'details', label: 'Extracted details', status: 'pending' },
      { id: 'generating', label: 'Generating demo page', status: 'pending' },
      { id: 'complete', label: 'Ready', status: 'pending' },
    ];

    const hasWebsite = Boolean(progress.website);
    const hasDetails = Boolean(
      progress.logoUrl ||
        progress.primaryColor ||
        progress.secondaryColor ||
        progress.phone ||
        progress.teamSize !== null ||
        progress.listingCount !== null
    );
    const hasHtml = progress.htmlProgress >= 100 || Boolean(progress.demoUrl);

    if (progress.status === 'complete') {
      return steps.map((step) => ({ ...step, status: 'complete' }));
    }

    if (progress.status === 'error') {
      steps[0].status = hasWebsite ? 'complete' : 'error';
      steps[1].status = hasDetails ? 'complete' : 'error';
      steps[2].status = 'error';
      return steps;
    }

    if (hasWebsite) {
      steps[0].status = 'complete';
    } else if (progress.status !== 'skeleton') {
      steps[0].status = 'in_progress';
    }

    if (hasDetails || progress.status === 'generating') {
      steps[1].status = 'complete';
    } else if (progress.status === 'extracting') {
      steps[1].status = 'in_progress';
    }

    if (progress.status === 'generating' && !hasHtml) {
      steps[2].status = 'in_progress';
    } else if (hasHtml) {
      steps[2].status = 'complete';
    }

    if (progress.demoUrl) {
      steps[3].status = 'complete';
    }

    return steps;
  };

  const computedSteps = buildSteps(data);
  const hasReportedSteps = data.steps?.some((step) => step.status !== 'pending') ?? false;
  const steps = hasReportedSteps ? data.steps ?? computedSteps : computedSteps;
  const demoUrl = normalizeDemoUrl(data.demoUrl);
  const fallbackLogoUrl = getFallbackLogo(data.website);
  const logoSrc = data.logoUrl || fallbackLogoUrl;
  const websiteHost = (() => {
    if (!data.website) return null;
    try {
      return new URL(data.website).hostname;
    } catch {
      return data.website;
    }
  })();

  // Note: formatPrice and priceRange removed 2026-01-18 (priceRangeMin/Max fields deprecated)

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
            {logoSrc ? (
              <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                <img
                  src={logoSrc}
                  alt={data.name || 'Agency'}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    if (fallbackLogoUrl && target.src !== fallbackLogoUrl) {
                      target.src = fallbackLogoUrl;
                    } else {
                      target.style.display = 'none';
                    }
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
                  {websiteHost}
                </a>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onToggleExpand}
            className="text-xs text-slate-500 hover:text-slate-200 transition-colors"
          >
            {isExpanded ? 'Hide details' : 'Show details'}
          </button>
        </div>

        {/* Metrics Row (simplified 2026-01-18: removed priceRange, soldCount, forRentCount) */}
        {(data.status === 'extracting' || data.status === 'generating' || data.status === 'complete') && (
          <div className="mt-3 space-y-1.5">
            {/* Listing Stats */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {data.listingCount !== null && (
                <span className="text-slate-400">
                  {data.listingCount} for sale
                </span>
              )}
              {data.teamSize !== null && (
                <>
                  {data.listingCount !== null && <span className="text-slate-600">•</span>}
                  <span className="text-slate-400">{data.teamSize} agents</span>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <MiniTodos status={data.status} />

        {/* Skeleton state */}
        {data.status === 'skeleton' && (
          <div className="space-y-3">
            <StepList steps={steps} />
          </div>
        )}

        {/* Extracting state */}
        {data.status === 'extracting' && (
          <div className="space-y-3">
            <StepList steps={steps} />
          </div>
        )}

        {/* Generating + Complete preview (painScore display removed 2026-01-18) */}
        {(data.status === 'generating' || data.status === 'complete') && (
          <div className="mt-3 space-y-3">
            <div className="relative">
              <ShimmerPreview
                primaryColor={data.primaryColor}
                secondaryColor={data.secondaryColor}
                progress={data.htmlProgress}
                isComplete={data.status === 'complete'}
              />

              {data.status === 'complete' && demoUrl && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <a
                    href={`${demoUrl}${data.sessionId ? `?session=${encodeURIComponent(data.sessionId)}` : ''}`}
                    className="px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm font-medium hover:bg-white/15 transition-colors"
                  >
                    Open Demo Page
                  </a>
                </div>
              )}
            </div>

            <div className="text-xs text-slate-500">
              {data.status === 'generating' ? 'Generating demo page…' : 'Ready.'}
            </div>
          </div>
        )}

        {/* Error state */}
        {data.status === 'error' && (
          <div className="space-y-3">
            <StepList steps={steps} />
            <p className="text-red-400 text-sm text-center">{data.error || 'Failed to process'}</p>
          </div>
        )}

        {isExpanded && (
          <div className="mt-4 border-t border-slate-700/60 pt-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs uppercase tracking-wide text-slate-500">Subagent stream</span>
              <span className="text-xs text-slate-600">{activity.length}</span>
            </div>
            <div className="max-h-40 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-transparent">
              {activity.length === 0 ? (
                <p className="text-slate-600 text-sm">No subagent activity yet.</p>
              ) : (
                activity.slice(-40).map((msg) => <ActivityMessageRow key={msg.id} message={msg} />)
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Re-export the type for backwards compatibility
export type { AgencyProgress };
