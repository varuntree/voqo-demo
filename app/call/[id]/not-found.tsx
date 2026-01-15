'use client';

export default function CallNotFound() {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white mb-4">Page Not Ready</h1>
        <p className="text-slate-400 mb-6">
          This post-call page is still being generated.<br />
          Please wait a moment and refresh.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg"
        >
          Refresh
        </button>
      </div>
    </div>
  );
}
