import { ActivityMessage as ActivityMessageType } from '@/lib/types';

interface ActivityMessageProps {
  message: ActivityMessageType;
}

const ICONS: Record<ActivityMessageType['type'], string> = {
  search: '🔍',
  results: '📄',
  fetch: '🌐',
  identified: '✓',
  warning: '⚠️',
  thinking: '💭',
};

const COLORS: Record<ActivityMessageType['type'], string> = {
  search: 'text-blue-400',
  results: 'text-slate-300',
  fetch: 'text-cyan-400',
  identified: 'text-green-400',
  warning: 'text-amber-400',
  thinking: 'text-purple-400',
};

export default function ActivityMessage({ message }: ActivityMessageProps) {
  const icon = ICONS[message.type];
  const colorClass = COLORS[message.type];

  return (
    <div className="activity-message flex items-start gap-2 py-1.5">
      <span className="text-sm w-5 flex-shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className={`text-sm ${colorClass}`}>{message.text}</p>
        {message.detail && (
          <p className="text-xs text-slate-500 truncate">{message.detail}</p>
        )}
      </div>
    </div>
  );
}
