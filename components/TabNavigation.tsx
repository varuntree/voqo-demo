'use client';

interface TabNavigationProps {
  activeTab: 'search' | 'history';
  onTabChange: (tab: 'search' | 'history') => void;
}

export default function TabNavigation({ activeTab, onTabChange }: TabNavigationProps) {
  return (
    <div className="flex gap-1 bg-slate-800/50 p-1 rounded-lg">
      <button
        onClick={() => onTabChange('search')}
        className={`
          px-4 py-2 rounded-md text-sm font-medium transition-all
          ${
            activeTab === 'search'
              ? 'bg-slate-700 text-white'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
          }
        `}
      >
        New Search
      </button>
      <button
        onClick={() => onTabChange('history')}
        className={`
          px-4 py-2 rounded-md text-sm font-medium transition-all
          ${
            activeTab === 'history'
              ? 'bg-slate-700 text-white'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
          }
        `}
      >
        History
      </button>
    </div>
  );
}
