'use client';

interface MockPreviewProps {
  primaryColor: string | null;
  progress: number;
}

export default function MockPreview({ primaryColor, progress }: MockPreviewProps) {
  const color = primaryColor || '#3b82f6'; // blue-500 fallback

  // Progress thresholds for each section
  const showHeader = progress >= 0;
  const showHero = progress >= 20;
  const showPainCards = progress >= 40;
  const showCTA = progress >= 60;
  const isComplete = progress >= 80;

  return (
    <div className="bg-slate-900 rounded-lg overflow-hidden border border-slate-700 aspect-[4/3]">
      {/* Mini page preview */}
      <div className="h-full flex flex-col p-2 gap-1.5">
        {/* Header */}
        <div
          className={`h-3 rounded transition-all duration-500 ${
            showHeader ? 'opacity-100' : 'opacity-30'
          }`}
          style={{ backgroundColor: color }}
        />

        {/* Hero */}
        <div
          className={`flex-1 rounded transition-all duration-500 ${
            showHero ? 'opacity-100' : 'opacity-30'
          }`}
          style={{
            background: `linear-gradient(135deg, ${color}40 0%, ${color}20 100%)`,
          }}
        >
          <div className="h-full flex items-center justify-center">
            <div className="w-1/2 h-1.5 bg-white/30 rounded" />
          </div>
        </div>

        {/* Pain cards row */}
        <div
          className={`flex gap-1.5 transition-all duration-500 ${
            showPainCards ? 'opacity-100' : 'opacity-30'
          }`}
        >
          <div className="flex-1 h-5 bg-slate-700 rounded" />
          <div className="flex-1 h-5 bg-slate-700 rounded" />
          <div className="flex-1 h-5 bg-slate-700 rounded" />
        </div>

        {/* CTA */}
        <div
          className={`h-4 rounded transition-all duration-500 ${
            showCTA ? 'opacity-100' : 'opacity-30'
          }`}
          style={{ backgroundColor: color }}
        />

        {/* Complete indicator */}
        {isComplete && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg animate-fadeIn">
            <svg
              className="w-8 h-8 text-green-500"
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
          </div>
        )}
      </div>
    </div>
  );
}
