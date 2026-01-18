'use client';

interface TabNavigationProps {
  activeTab: 'search' | 'history';
  onTabChange: (tab: 'search' | 'history') => void;
}

export default function TabNavigation({ activeTab, onTabChange }: TabNavigationProps) {
  return (
    <div className="flex gap-1 bg-stone-100 p-1.5 rounded-full">
      <button
        onClick={() => onTabChange('search')}
        className={`
          px-5 py-2 rounded-full text-xs font-mono uppercase tracking-widest font-medium transition-all
          ${
            activeTab === 'search'
              ? 'bg-white text-stone-900 shadow-sm'
              : 'text-stone-500 hover:text-stone-700 hover:bg-white/50'
          }
        `}
      >
        New Search
      </button>
      <button
        onClick={() => onTabChange('history')}
        className={`
          px-5 py-2 rounded-full text-xs font-mono uppercase tracking-widest font-medium transition-all
          ${
            activeTab === 'history'
              ? 'bg-white text-stone-900 shadow-sm'
              : 'text-stone-500 hover:text-stone-700 hover:bg-white/50'
          }
        `}
      >
        History
      </button>
    </div>
  );
}
