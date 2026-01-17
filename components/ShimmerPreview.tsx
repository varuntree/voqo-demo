'use client';

interface ShimmerPreviewProps {
  primaryColor: string | null;
  secondaryColor: string | null;
  progress: number;
  isComplete: boolean;
}

export default function ShimmerPreview({
  primaryColor,
  secondaryColor,
  progress,
  isComplete,
}: ShimmerPreviewProps) {
  const primary = primaryColor || '#3b82f6';
  const secondary = secondaryColor || '#0ea5e9';
  const pct = Math.max(0, Math.min(100, progress));

  return (
    <div className="relative bg-slate-900 rounded-lg overflow-hidden border border-slate-700 aspect-[4/3]">
      <div
        className={`absolute inset-0 transition-all duration-500 ${isComplete ? 'opacity-45 grayscale' : 'opacity-100'}`}
        style={{
          background: `radial-gradient(1000px circle at 20% 10%, ${primary}33 0%, transparent 40%),
            radial-gradient(900px circle at 80% 20%, ${secondary}22 0%, transparent 45%),
            linear-gradient(180deg, rgba(2,6,23,0.0) 0%, rgba(2,6,23,0.55) 100%)`,
        }}
      />

      {/* Layout blocks */}
      <div className="relative h-full p-2 flex flex-col gap-2">
        <div className="h-3 rounded bg-slate-800/70 overflow-hidden">
          <div className="h-full w-1/2" style={{ backgroundColor: primary }} />
        </div>

        <div className="flex-1 rounded bg-slate-800/60 overflow-hidden">
          <div className="h-full w-2/3" style={{ background: `linear-gradient(90deg, ${primary}33, ${secondary}22)` }} />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="h-5 rounded bg-slate-800/70" />
          <div className="h-5 rounded bg-slate-800/70" />
          <div className="h-5 rounded bg-slate-800/70" />
        </div>

        <div className="h-4 rounded bg-slate-800/70 overflow-hidden">
          <div className="h-full w-1/3" style={{ backgroundColor: secondary }} />
        </div>
      </div>

      {/* Shimmer overlay */}
      {!isComplete && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="shimmer absolute inset-0" />
        </div>
      )}

      {/* Progress */}
      <div className="absolute left-2 right-2 bottom-2">
        <div className="h-1.5 bg-slate-800/80 rounded-full overflow-hidden">
          <div
            className="h-full transition-all duration-300"
            style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${primary}, ${secondary})` }}
          />
        </div>
      </div>

      <style jsx>{`
        .shimmer {
          background: linear-gradient(
            120deg,
            rgba(255, 255, 255, 0) 30%,
            rgba(255, 255, 255, 0.08) 45%,
            rgba(255, 255, 255, 0) 60%
          );
          transform: translateX(-60%);
          animation: shimmerMove 1.4s ease-in-out infinite;
        }
        @keyframes shimmerMove {
          0% {
            transform: translateX(-60%);
          }
          100% {
            transform: translateX(60%);
          }
        }
      `}</style>
    </div>
  );
}

