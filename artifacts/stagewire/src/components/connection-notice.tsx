import { useEffect, useState } from 'react';
import { getOfflineOutboxCount, subscribeToOfflineOutbox } from '@/offline-outbox';

export function ConnectionNotice() {
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' ? true : navigator.onLine);
  const [restored, setRestored] = useState(false);
  const [pending, setPending] = useState(() => getOfflineOutboxCount());
  const [syncMessage, setSyncMessage] = useState('');

  useEffect(() => {
    let restoreTimer: number | undefined;
    const clearLater = () => {
      if (restoreTimer) window.clearTimeout(restoreTimer);
      restoreTimer = window.setTimeout(() => {
        setRestored(false);
        setSyncMessage('');
      }, 5000);
    };
    const handleOffline = () => {
      if (restoreTimer) window.clearTimeout(restoreTimer);
      setRestored(false);
      setOnline(false);
    };
    const handleOnline = () => {
      setOnline(true);
      setRestored(true);
      clearLater();
    };
    const unsubscribe = subscribeToOfflineOutbox((detail) => {
      setPending(detail.pending);
      if (detail.synced) {
        setSyncMessage(`${detail.synced} saved action${detail.synced === 1 ? '' : 's'} uploaded.`);
        setRestored(true);
        clearLater();
      } else if (detail.rejected) {
        setSyncMessage(`${detail.rejected} saved action${detail.rejected === 1 ? '' : 's'} could not be applied. Review the active call.`);
        setRestored(true);
        clearLater();
      }
    });

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      unsubscribe();
      if (restoreTimer) window.clearTimeout(restoreTimer);
    };
  }, []);

  if (!online) {
    return (
      <div className="connection-notice connection-offline print-hide" role="status" aria-live="polite">
        <strong>No network connection.</strong>
        <span>
          {pending > 0
            ? `${pending} workday action${pending === 1 ? ' is' : 's are'} safely waiting on this device. StageWire will upload ${pending === 1 ? 'it' : 'them'} when signal returns.`
            : 'Keep this screen open. Workday actions can be saved on this device and uploaded when signal returns.'}
        </span>
      </div>
    );
  }

  if (pending > 0) {
    return (
      <div className="connection-notice connection-restored print-hide" role="status" aria-live="polite">
        <strong>Connection available.</strong>
        <span>Uploading {pending} saved workday action{pending === 1 ? '' : 's'}…</span>
      </div>
    );
  }

  if (restored || syncMessage) {
    return (
      <div className="connection-notice connection-restored print-hide" role="status" aria-live="polite">
        <strong>Connection restored.</strong>
        <span>{syncMessage || 'StageWire is ready.'}</span>
      </div>
    );
  }

  return null;
}
