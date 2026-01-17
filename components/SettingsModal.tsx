'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  VoiceAgentSettings,
  DEFAULT_VOICE_AGENT_SETTINGS,
  AVAILABLE_VARIABLES,
} from '@/lib/types';

const STORAGE_KEY = 'voqo:voiceAgentSettings';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function extractVariables(text: string): string[] {
  const regex = /\{\{([^}]+)\}\}/g;
  const matches: string[] = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    matches.push(`{{${match[1]}}}`);
  }
  return [...new Set(matches)];
}

function findUnknownVariables(settings: VoiceAgentSettings): string[] {
  const allText = settings.systemPrompt + ' ' + settings.firstMessage;
  const found = extractVariables(allText);
  const available = new Set(AVAILABLE_VARIABLES as readonly string[]);
  return found.filter((v) => !available.has(v));
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_VOICE_AGENT_SETTINGS.systemPrompt);
  const [firstMessage, setFirstMessage] = useState(DEFAULT_VOICE_AGENT_SETTINGS.firstMessage);
  const [unknownVars, setUnknownVars] = useState<string[]>([]);

  // Use ref to avoid re-running effect when onClose changes
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Handle Escape key to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Load from localStorage on mount
  useEffect(() => {
    if (!isOpen) return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as VoiceAgentSettings;
        setSystemPrompt(parsed.systemPrompt ?? DEFAULT_VOICE_AGENT_SETTINGS.systemPrompt);
        setFirstMessage(parsed.firstMessage ?? DEFAULT_VOICE_AGENT_SETTINGS.firstMessage);
      } else {
        setSystemPrompt(DEFAULT_VOICE_AGENT_SETTINGS.systemPrompt);
        setFirstMessage(DEFAULT_VOICE_AGENT_SETTINGS.firstMessage);
      }
    } catch {
      setSystemPrompt(DEFAULT_VOICE_AGENT_SETTINGS.systemPrompt);
      setFirstMessage(DEFAULT_VOICE_AGENT_SETTINGS.firstMessage);
    }
  }, [isOpen]);

  // Validate for unknown variables whenever fields change
  useEffect(() => {
    const unknown = findUnknownVariables({ systemPrompt, firstMessage });
    setUnknownVars(unknown);
  }, [systemPrompt, firstMessage]);

  const handleSave = () => {
    const settings: VoiceAgentSettings = { systemPrompt, firstMessage };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    onClose();
  };

  const handleReset = () => {
    setSystemPrompt(DEFAULT_VOICE_AGENT_SETTINGS.systemPrompt);
    setFirstMessage(DEFAULT_VOICE_AGENT_SETTINGS.firstMessage);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/70"
        onClick={onClose}
        aria-label="Close modal"
      />

      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-700 flex items-center justify-between">
          <h3 className="text-white font-semibold">Voice Agent Settings</h3>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors"
          >
            Close
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-5">
          {/* Unknown variable warning */}
          {unknownVars.length > 0 && (
            <div className="bg-amber-500/15 border border-amber-500/30 rounded-lg p-3 text-amber-200 text-sm">
              <span className="font-medium">Warning:</span> Unknown variable(s) detected:{' '}
              <code className="bg-amber-500/20 px-1 rounded">{unknownVars.join(', ')}</code>
            </div>
          )}

          {/* Available variables reference */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
            <div className="text-slate-400 text-xs mb-2 font-medium">Available Variables</div>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_VARIABLES.map((v) => (
                <code
                  key={v}
                  className="bg-slate-700/60 text-slate-300 px-2 py-0.5 rounded text-xs"
                >
                  {v}
                </code>
              ))}
            </div>
          </div>

          {/* First Message */}
          <div>
            <label className="block text-slate-300 text-sm font-medium mb-2">First Message</label>
            <textarea
              value={firstMessage}
              onChange={(e) => setFirstMessage(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 rounded-xl bg-white/10 border border-slate-600 text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm"
              placeholder="Enter the first message the agent says..."
            />
          </div>

          {/* System Prompt */}
          <div>
            <label className="block text-slate-300 text-sm font-medium mb-2">System Prompt</label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={16}
              className="w-full px-4 py-3 rounded-xl bg-white/10 border border-slate-600 text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm font-mono"
              placeholder="Enter the system prompt for the voice agent..."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-700 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleReset}
            className="px-4 py-2 text-sm rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
          >
            Reset to Defaults
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
