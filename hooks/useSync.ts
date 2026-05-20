import * as React from 'react';

import { syncChecklist } from '@/lib/offline/sync';

export function useSync() {
  React.useEffect(() => {
    const handleOnline = () => {
      console.log('[useSync] Browser is online, running syncChecklist');
      syncChecklist();
    };

    const runInitialSync = async () => {
      if (navigator.onLine) {
        console.log('[useSync] App loaded online, running syncChecklist');
        await syncChecklist();
      } else {
        console.log('[useSync] App loaded offline, waiting for online event');
      }
    };

    runInitialSync();
    window.addEventListener('online', handleOnline);

    const intervalId = window.setInterval(() => {
      if (navigator.onLine) {
        console.log('[useSync] Periodic sync retry');
        syncChecklist();
      }
    }, 15000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.clearInterval(intervalId);
    };
  }, []);
}
