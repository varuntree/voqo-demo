'use client';

import { CardStep } from '@/lib/types';

interface StepListProps {
  steps: CardStep[];
}

export default function StepList({ steps }: StepListProps) {
  const getStepIcon = (status: CardStep['status']) => {
    switch (status) {
      case 'pending':
        return (
          <span className="text-slate-500">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <circle cx="12" cy="12" r="9" strokeWidth="2" />
            </svg>
          </span>
        );
      case 'in_progress':
        return (
          <span className="text-blue-400">
            <svg className="w-3.5 h-3.5 animate-pulse" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="6" />
            </svg>
          </span>
        );
      case 'complete':
        return (
          <span className="text-green-400">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
          </span>
        );
      case 'error':
        return (
          <span className="text-red-400">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </span>
        );
    }
  };

  const getStepTextClass = (status: CardStep['status']) => {
    switch (status) {
      case 'pending':
        return 'text-slate-500';
      case 'in_progress':
        return 'text-blue-400';
      case 'complete':
        return 'text-green-400';
      case 'error':
        return 'text-red-400';
    }
  };

  if (!steps || steps.length === 0) return null;

  return (
    <div className="space-y-1.5">
      {steps.map((step) => (
        <div
          key={step.id}
          className={`flex items-center gap-2 text-xs transition-all duration-300 ${
            step.status === 'in_progress' ? 'animate-fadeIn' : ''
          }`}
        >
          {getStepIcon(step.status)}
          <span className={getStepTextClass(step.status)}>{step.label}</span>
        </div>
      ))}
    </div>
  );
}
