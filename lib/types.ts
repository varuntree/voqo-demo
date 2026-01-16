// Shared types for the pipeline system

// Activity message for agent streaming
export interface ActivityMessage {
  id: string;
  type: 'search' | 'results' | 'fetch' | 'identified' | 'warning' | 'thinking' | 'tool' | 'agent';
  text: string;
  detail?: string;
  source?: string;
  timestamp: string;
}

// Activity tracking for pipeline
export interface Activity {
  status: 'active' | 'complete';
  agenciesFound: number;
  agenciesTarget: number;
  messages: ActivityMessage[];
}

export interface CardStep {
  id: 'website' | 'details' | 'generating' | 'complete';
  label: string;
  status: 'pending' | 'in_progress' | 'complete' | 'error';
}

export interface AgencyProgress {
  // Identity
  agencyId: string;
  sessionId: string;

  // Client-only placeholder flag
  isPlaceholder?: boolean;

  // Status
  status: 'skeleton' | 'extracting' | 'generating' | 'complete' | 'error';
  updatedAt: string;

  // Basic Info
  name: string | null;
  website: string | null;
  phone: string | null;
  address: string | null;

  // Branding
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;

  // Metrics (existing)
  teamSize: number | null;
  listingCount: number | null;
  painScore: number | null;

  // Metrics (enhanced - from existing searches)
  soldCount: number | null;
  priceRangeMin: string | null;
  priceRangeMax: string | null;
  forRentCount: number | null;

  // Generation
  htmlProgress: number;
  demoUrl: string | null;

  // Step Tracking
  steps?: CardStep[];

  // Error
  error?: string;
}

export interface PipelineState {
  sessionId: string;
  suburb: string;
  requestedCount: number;
  status: 'searching' | 'processing' | 'complete' | 'error';
  startedAt: string;
  completedAt: string | null;
  todos: Array<{
    id: string;
    text: string;
    status: 'pending' | 'in_progress' | 'complete';
  }>;
  agencyIds: string[];
  activity?: Activity;
  error?: string;
}

export interface SearchSession {
  sessionId: string;
  name: string;
  suburb: string;
  requestedCount: number;
  actualCount: number;
  successCount: number;
  createdAt: string;
  completedAt: string | null;
  status: 'running' | 'complete' | 'partial' | 'failed';
  agencies: Array<{
    id: string;
    name: string;
    logoUrl: string | null;
    demoUrl: string | null;
  }>;
}

export interface HistoryFile {
  sessions: SearchSession[];
}

// Default steps for new agencies
export const DEFAULT_STEPS: CardStep[] = [
  { id: 'website', label: 'Found website', status: 'pending' },
  { id: 'details', label: 'Extracted details', status: 'pending' },
  { id: 'generating', label: 'Generating demo page', status: 'pending' },
  { id: 'complete', label: 'Ready', status: 'pending' },
];
