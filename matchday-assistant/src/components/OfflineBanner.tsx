'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { flushQueue, pendingCount } from '@/lib/offlineQueue';

/**
 * Sticky banner shown at the top of every protected page when offline.
 * Automatically flushes the offline mutation queue when reconnected.
 */
export default function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncedCount, setSyncedCount] = useState(0);
  const justReconnected = useRef(false);

  useEffect(() => {
    // Initialise from current state
    setIsOnline(navigator.onLine);

    async function handleOnline() {
      setIsOnline(true);
      justReconnected.current = true;

      const pending = pendingCount();
      if (pending > 0) {
        setSyncing(true);
        const supabase = createClient();
        await flushQueue(supabase);
        setSyncedCount(pending - pendingCount());
        setSyncing(false);
        // Clear the "synced" notice after 4 s
        setTimeout(() => {
          setSyncedCount(0);
          justReconnected.current = false;
        }, 4000);
      }
    }

    function handleOffline() {
      setIsOnline(false);
      justReconnected.current = false;
      setSyncedCount(0);
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Nothing to show when online and no pending sync notice
  if (isOnline && syncedCount === 0 && !syncing) return null;

  if (syncing) {
    return (
      <div className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-blue-600 px-4 py-2 text-sm text-white">
        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Syncing offline changes…
      </div>
    );
  }

  if (syncedCount > 0) {
    return (
      <div className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-green-600 px-4 py-2 text-sm text-white">
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
        Back online — {syncedCount} change{syncedCount !== 1 ? 's' : ''} synced
      </div>
    );
  }

  // Offline
  return (
    <div className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-sm font-medium text-slate-900">
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M18.364 5.636a9 9 0 010 12.728M15.536 8.464a5 5 0 010 7.072M12 12h.01M3 3l18 18" />
      </svg>
      Offline — changes saved locally and will sync when connected
    </div>
  );
}
