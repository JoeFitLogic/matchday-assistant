'use client';

import { useEffect, useState } from 'react';

export default function OfflinePage() {
  const [isRetrying, setIsRetrying] = useState(false);

  function retry() {
    setIsRetrying(true);
    // Brief delay so the spinner shows, then try navigating back
    setTimeout(() => {
      window.location.href = '/';
    }, 500);
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center px-6 text-center">
      {/* Icon */}
      <div className="mb-8">
        <div className="w-24 h-24 rounded-3xl bg-green-600 flex items-center justify-center mx-auto mb-4">
          {/* Football SVG */}
          <svg viewBox="0 0 80 80" className="w-14 h-14" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="40" cy="40" r="32" fill="white" stroke="#1e293b" strokeWidth="2" />
            <polygon points="40,28 46,34 44,42 36,42 34,34" fill="#1e293b" />
            <polygon points="40,14 44,20 40,26 36,20" fill="#1e293b" opacity="0.8" />
            <polygon points="58,28 60,35 54,40 50,36 52,28" fill="#1e293b" opacity="0.8" />
            <polygon points="22,28 28,28 30,36 26,40 20,35" fill="#1e293b" opacity="0.8" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-white mb-1">You&apos;re offline</h1>
        <p className="text-slate-400 text-sm">No internet connection detected</p>
      </div>

      {/* Info box */}
      <div className="w-full max-w-sm bg-slate-800 rounded-2xl p-5 mb-8 text-left space-y-3">
        <p className="text-slate-300 text-sm font-medium">Available offline:</p>
        <div className="space-y-2">
          {[
            'Session lineups you already opened',
            'Player rosters loaded today',
            'Match minutes you recorded this session',
          ].map((item) => (
            <div key={item} className="flex items-start gap-3">
              <span className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-green-600/20 flex items-center justify-center">
                <svg className="w-3 h-3 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </span>
              <span className="text-slate-300 text-sm">{item}</span>
            </div>
          ))}
        </div>
        <div className="border-t border-slate-700 pt-3">
          <p className="text-slate-500 text-xs">
            Any changes you make will sync automatically when your connection returns.
          </p>
        </div>
      </div>

      {/* Retry button */}
      <button
        onClick={retry}
        disabled={isRetrying}
        className="w-full max-w-sm bg-green-600 hover:bg-green-500 disabled:opacity-60 text-white font-semibold py-4 rounded-2xl text-base transition-colors"
      >
        {isRetrying ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Retrying…
          </span>
        ) : (
          'Try again'
        )}
      </button>

      <p className="mt-6 text-slate-600 text-xs">
        Matchday Assistant • Livingston Community FC
      </p>
    </div>
  );
}
