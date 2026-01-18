'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  VoiceAgentSettings,
  DEFAULT_VOICE_AGENT_SETTINGS,
  AVAILABLE_VARIABLES,
  DEFAULT_SMS_TEMPLATE,
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
  const allText = settings.systemPrompt + ' ' + settings.firstMessage + ' ' + settings.smsTemplate;
  const found = extractVariables(allText);
  const available = new Set(AVAILABLE_VARIABLES as readonly string[]);
  return found.filter((v) => !available.has(v));
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_VOICE_AGENT_SETTINGS.systemPrompt);
  const [firstMessage, setFirstMessage] = useState(DEFAULT_VOICE_AGENT_SETTINGS.firstMessage);
  const [smsTemplate, setSmsTemplate] = useState(DEFAULT_SMS_TEMPLATE);
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
        setSmsTemplate(parsed.smsTemplate ?? DEFAULT_SMS_TEMPLATE);
      } else {
        setSystemPrompt(DEFAULT_VOICE_AGENT_SETTINGS.systemPrompt);
        setFirstMessage(DEFAULT_VOICE_AGENT_SETTINGS.firstMessage);
        setSmsTemplate(DEFAULT_SMS_TEMPLATE);
      }
    } catch {
      setSystemPrompt(DEFAULT_VOICE_AGENT_SETTINGS.systemPrompt);
      setFirstMessage(DEFAULT_VOICE_AGENT_SETTINGS.firstMessage);
      setSmsTemplate(DEFAULT_SMS_TEMPLATE);
    }
  }, [isOpen]);

  // Validate for unknown variables whenever fields change
  useEffect(() => {
    const unknown = findUnknownVariables({ systemPrompt, firstMessage, smsTemplate });
    setUnknownVars(unknown);
  }, [systemPrompt, firstMessage, smsTemplate]);

  const handleSave = () => {
    const settings: VoiceAgentSettings = { systemPrompt, firstMessage, smsTemplate };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    onClose();
  };

  const handleReset = () => {
    setSystemPrompt(DEFAULT_VOICE_AGENT_SETTINGS.systemPrompt);
    setFirstMessage(DEFAULT_VOICE_AGENT_SETTINGS.firstMessage);
    setSmsTemplate(DEFAULT_SMS_TEMPLATE);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-stone-950/60 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close modal"
      />

      <div className="relative w-full max-w-3xl bg-white border-2 border-stone-100 rounded-3xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-stone-100 flex items-center justify-between">
          <h3 className="text-stone-900 font-semibold text-lg">Voice Agent Settings</h3>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-mono uppercase tracking-widest rounded-full bg-stone-100 text-stone-600 hover:bg-stone-200 transition-colors"
          >
            Close
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {/* Unknown variable warning */}
          {unknownVars.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-800 text-sm">
              <span className="font-medium">Warning:</span> Unknown variable(s) detected:{' '}
              <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono text-xs">{unknownVars.join(', ')}</code>
            </div>
          )}

          {/* Available variables reference */}
          <div className="bg-stone-50 border border-stone-200 rounded-xl p-4">
            <div className="text-stone-500 text-xs mb-3 font-mono uppercase tracking-widest font-medium">Available Variables</div>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_VARIABLES.map((v) => (
                <code
                  key={v}
                  className="bg-stone-100 text-stone-600 px-2.5 py-1 rounded-full text-xs font-mono"
                >
                  {v}
                </code>
              ))}
            </div>
          </div>

          {/* First Message */}
          <div>
            <label className="block text-stone-700 text-sm font-medium mb-2">First Message</label>
            <textarea
              value={firstMessage}
              onChange={(e) => setFirstMessage(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 rounded-xl bg-stone-50 border border-stone-200 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#00C853] focus:border-transparent resize-none text-sm"
              placeholder="Enter the first message the agent says..."
            />
          </div>

          {/* SMS Template */}
          <div>
            <label className="block text-stone-700 text-sm font-medium mb-2">SMS Template</label>
            <textarea
              value={smsTemplate}
              onChange={(e) => setSmsTemplate(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 rounded-xl bg-stone-50 border border-stone-200 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#00C853] focus:border-transparent resize-none text-sm"
              placeholder="SMS message sent after call..."
            />
            <p className="text-stone-500 text-xs mt-1">Sent to caller after their personalized page is ready</p>
          </div>

          {/* System Prompt */}
          <div>
            <label className="block text-stone-700 text-sm font-medium mb-2">System Prompt</label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={16}
              className="w-full px-4 py-3 rounded-xl bg-stone-50 border border-stone-200 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#00C853] focus:border-transparent resize-none text-sm font-mono"
              placeholder="Enter the system prompt for the voice agent..."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-5 border-t border-stone-100 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleReset}
            className="px-5 py-2.5 text-xs font-mono uppercase tracking-widest rounded-full bg-stone-100 text-stone-600 hover:bg-stone-200 transition-colors"
          >
            Reset to Defaults
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-xs font-mono uppercase tracking-widest rounded-full bg-stone-100 text-stone-600 hover:bg-stone-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-6 py-2.5 text-xs font-mono uppercase tracking-widest rounded-full bg-[#00C853] text-white hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-500/20"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
