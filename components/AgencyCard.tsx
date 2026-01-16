'use client';

import { AgencyProgress, DEFAULT_STEPS } from '@/lib/types';
import StepList from './StepList';
import MockPreview from './MockPreview';

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

  const borderColor = data.primaryColor || '#475569'; // slate-600 fallback
  const steps = data.steps && data.steps.length > 0 ? data.steps : DEFAULT_STEPS;

  // Format price for display
  const formatPrice = (price: string | null) => {
    if (!price) return null;
    // If already formatted, return as-is
    if (price.startsWith('$')) return price;
    // Otherwise format
    const num = parseFloat(price);
    if (isNaN(num)) return price;
    if (num >= 1000000) return `$${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `$${(num / 1000).toFixed(0)}K`;
    return `$${num}`;
  };

  const priceMin = formatPrice(data.priceRangeMin);
  const priceMax = formatPrice(data.priceRangeMax);
  const priceRange = priceMin && priceMax ? `${priceMin} - ${priceMax}` : null;

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
        </div>

        {/* Enhanced Metrics Row */}
        {(data.status === 'extracting' || data.status === 'generating' || data.status === 'complete') && (
          <div className="mt-3 space-y-1.5">
            {/* Price Range */}
            {priceRange && (
              <div className="flex items-center gap-2 text-sm animate-fadeIn">
                <span className="text-amber-400">$</span>
                <span className="text-slate-300">{priceRange}</span>
              </div>
            )}

            {/* Listing Stats */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {data.listingCount !== null && (
                <span className="text-slate-400">
                  {data.listingCount} for sale
                </span>
              )}
              {data.soldCount !== null && data.soldCount > 0 && (
                <>
                  <span className="text-slate-600">•</span>
                  <span className="text-slate-400">{data.soldCount} sold</span>
                </>
              )}
              {data.forRentCount !== null && data.forRentCount > 0 && (
                <>
                  <span className="text-slate-600">•</span>
                  <span className="text-slate-400">{data.forRentCount} rentals</span>
                </>
              )}
            </div>

            {/* Team Size */}
            {data.teamSize !== null && (
              <div className="text-xs text-slate-400">
                {data.teamSize} agents
              </div>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
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

        {/* Generating state */}
        {data.status === 'generating' && (
          <div className="space-y-3">
            {/* Pain Score badge */}
            {data.painScore !== null && (
              <div className="flex justify-end">
                <span
                  className={`px-2 py-1 rounded text-xs font-medium ${getPainScoreColor(
                    data.painScore
                  )}`}
                >
                  Pain: {data.painScore}
                </span>
              </div>
            )}

            {/* Steps */}
            <StepList steps={steps} />

            {/* Mock Preview */}
            <MockPreview
              primaryColor={data.primaryColor}
              progress={data.htmlProgress}
            />
          </div>
        )}

        {/* Complete state */}
        {data.status === 'complete' && (
          <div className="space-y-3">
            {/* Pain Score badge */}
            {data.painScore !== null && (
              <div className="flex justify-end">
                <span
                  className={`px-2 py-1 rounded text-xs font-medium ${getPainScoreColor(
                    data.painScore
                  )}`}
                >
                  Pain: {data.painScore}
                </span>
              </div>
            )}

            {/* Steps */}
            <StepList steps={steps} />

            {/* View Demo button */}
            {data.demoUrl && (
              <a
                href={data.demoUrl}
                className="block w-full py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-medium rounded-lg text-center transition-all mt-3"
              >
                View Demo
              </a>
            )}
          </div>
        )}

        {/* Error state */}
        {data.status === 'error' && (
          <div className="space-y-3">
            <StepList steps={steps} />
            <p className="text-red-400 text-sm text-center">{data.error || 'Failed to process'}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Re-export the type for backwards compatibility
export type { AgencyProgress };
