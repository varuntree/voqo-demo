'use client';

import { useState } from 'react';

interface Agency {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  branding?: {
    logoUrl?: string;
    primaryColor?: string;
  };
  metrics?: {
    listingCount?: number;
    teamSize?: number;
    painScore?: number;
  };
}

export default function Home() {
  const [suburb, setSuburb] = useState('');
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!suburb.trim()) return;

    setLoading(true);
    setError('');
    setAgencies([]);

    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suburb: suburb.trim() }),
      });

      const data = await res.json();
      if (data.agencies) {
        setAgencies(data.agencies);
      } else if (data.error) {
        setError(data.error);
      }
    } catch (err) {
      setError('Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateDemo(agency: Agency) {
    setGenerating(agency.id);
    try {
      const res = await fetch('/api/generate-demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agencyId: agency.id }),
      });

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      setError('Failed to generate demo page.');
    } finally {
      setGenerating(null);
    }
  }

  function getPainScoreColor(score?: number) {
    if (!score) return 'bg-gray-200 text-gray-600';
    if (score >= 70) return 'bg-red-100 text-red-700';
    if (score >= 40) return 'bg-yellow-100 text-yellow-700';
    return 'bg-green-100 text-green-700';
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      {/* Header */}
      <header className="border-b border-slate-700 bg-slate-900/50 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-white">Voqo</span>
            <span className="text-slate-400 text-sm">Lead Engine</span>
          </div>
        </div>
      </header>

      {/* Hero + Search */}
      <section className="py-16 md:py-24">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Find Real Estate Agencies
          </h1>
          <p className="text-xl text-slate-300 mb-8">
            Search any suburb to discover agencies and generate personalized demos
          </p>

          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3 max-w-xl mx-auto">
            <input
              type="text"
              value={suburb}
              onChange={(e) => setSuburb(e.target.value)}
              placeholder="Enter suburb (e.g. Surry Hills)"
              className="flex-1 px-5 py-4 rounded-xl bg-white/10 border border-slate-600 text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              type="submit"
              disabled={loading}
              className="px-8 py-4 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-semibold rounded-xl transition-colors"
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </form>

          {error && (
            <p className="mt-4 text-red-400">{error}</p>
          )}
        </div>
      </section>

      {/* Loading State */}
      {loading && (
        <section className="py-8">
          <div className="max-w-6xl mx-auto px-4 text-center">
            <div className="inline-flex items-center gap-3 px-6 py-3 bg-slate-800 rounded-full">
              <svg className="animate-spin h-5 w-5 text-blue-500" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-slate-300">Researching agencies in {suburb}...</span>
            </div>
            <p className="mt-3 text-sm text-slate-500">This may take 1-2 minutes</p>
          </div>
        </section>
      )}

      {/* Results */}
      {agencies.length > 0 && (
        <section className="py-8 pb-16">
          <div className="max-w-6xl mx-auto px-4">
            <h2 className="text-2xl font-bold text-white mb-6">
              Found {agencies.length} agencies
            </h2>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {agencies.map((agency) => (
                <div
                  key={agency.id}
                  className="bg-slate-800 rounded-xl p-6 border border-slate-700 hover:border-slate-600 transition-colors"
                >
                  {/* Logo */}
                  {agency.branding?.logoUrl && (
                    <div className="h-12 mb-4">
                      <img
                        src={agency.branding.logoUrl}
                        alt={agency.name}
                        className="h-full object-contain"
                      />
                    </div>
                  )}

                  {/* Name + Address */}
                  <h3 className="text-lg font-semibold text-white mb-1">
                    {agency.name}
                  </h3>
                  {agency.address && (
                    <p className="text-slate-400 text-sm mb-3">{agency.address}</p>
                  )}

                  {/* Metrics */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {agency.metrics?.listingCount !== undefined && (
                      <span className="px-2 py-1 bg-slate-700 rounded text-xs text-slate-300">
                        {agency.metrics.listingCount} listings
                      </span>
                    )}
                    {agency.metrics?.teamSize !== undefined && (
                      <span className="px-2 py-1 bg-slate-700 rounded text-xs text-slate-300">
                        {agency.metrics.teamSize} agents
                      </span>
                    )}
                    {agency.metrics?.painScore !== undefined && (
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getPainScoreColor(agency.metrics.painScore)}`}>
                        Pain: {agency.metrics.painScore}
                      </span>
                    )}
                  </div>

                  {/* Action */}
                  <button
                    onClick={() => handleGenerateDemo(agency)}
                    disabled={generating === agency.id}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-medium rounded-lg transition-colors"
                  >
                    {generating === agency.id ? 'Generating...' : 'Generate Demo'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
