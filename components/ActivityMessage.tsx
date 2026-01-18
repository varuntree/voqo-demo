import { ActivityMessage as ActivityMessageType } from '@/lib/types';

interface ActivityMessageProps {
  message: ActivityMessageType;
}

const COLORS: Record<ActivityMessageType['type'], string> = {
  search: 'text-[#00C853]',
  results: 'text-stone-600',
  fetch: 'text-emerald-500',
  identified: 'text-[#00C853]',
  warning: 'text-amber-600',
  thinking: 'text-stone-500',
  tool: 'text-stone-700',
  agent: 'text-[#00C853]',
};

function Icon({ type }: { type: ActivityMessageType['type'] }) {
  const common = 'w-4 h-4';
  switch (type) {
    case 'search':
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z" />
          <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
        </svg>
      );
    case 'results':
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M8 6h13M8 12h13M8 18h13" />
          <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M3 6h.01M3 12h.01M3 18h.01" />
        </svg>
      );
    case 'fetch':
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 1 1-9-9 9 9 0 0 1 9 9Z" />
          <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M3.6 9h16.8M3.6 15h16.8" />
          <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 3a14 14 0 0 0 0 18" />
          <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 3a14 14 0 0 1 0 18" />
        </svg>
      );
    case 'identified':
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M20 6 9 17l-5-5" />
        </svg>
      );
    case 'warning':
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01" />
          <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M10.3 4.4 2.7 18a2 2 0 0 0 1.8 3h15a2 2 0 0 0 1.8-3L13.7 4.4a2 2 0 0 0-3.4 0Z" />
        </svg>
      );
    case 'thinking':
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M8 14a4 4 0 1 1 8 0c0 1.2-.5 2.1-1.2 2.8-.7.7-1.3 1.7-1.3 2.2V21H10v-.0c0-.5-.6-1.5-1.3-2.2C8.5 16.1 8 15.2 8 14Z" />
          <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 3v2" />
          <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M4.2 6.2 5.6 7.6" />
          <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M19.8 6.2 18.4 7.6" />
        </svg>
      );
    case 'tool':
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M14.7 6.3a5 5 0 0 0-6.4 6.4L3 18l3 3 5.3-5.3a5 5 0 0 0 6.4-6.4l-3 3-2-2 3-3Z" />
        </svg>
      );
    case 'agent':
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M7 9h10v7a3 3 0 0 1-3 3H10a3 3 0 0 1-3-3V9Z" />
          <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M9 9V7a3 3 0 0 1 6 0v2" />
          <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M10 13h.01M14 13h.01" />
        </svg>
      );
  }
}

export default function ActivityMessage({ message }: ActivityMessageProps) {
  const colorClass = COLORS[message.type];

  return (
    <div className="activity-message flex items-start gap-2 py-1.5">
      <span className={`w-5 flex-shrink-0 ${colorClass}`}>
        <Icon type={message.type} />
      </span>
      <div className="flex-1 min-w-0">
        <p className={`text-sm ${colorClass}`}>
          {message.source && (
            <span className="mr-2 text-[10px] uppercase tracking-wide text-stone-400 font-mono">
              {message.source}
            </span>
          )}
          {message.text}
        </p>
        {message.detail && (
          <p className="text-xs text-stone-400 truncate">{message.detail}</p>
        )}
      </div>
    </div>
  );
}
