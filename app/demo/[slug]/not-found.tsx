import Link from 'next/link';

export default function DemoNotFound() {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white mb-4">Demo Not Found</h1>
        <p className="text-slate-400 mb-6">
          This demo page hasn&apos;t been generated yet.
        </p>
        <Link
          href="/"
          className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg"
        >
          Search Agencies
        </Link>
      </div>
    </div>
  );
}
