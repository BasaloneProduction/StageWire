import { useEffect, useState } from 'react';

export function ConnectionNotice() {
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' ? true : navigator.onLine);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    let restoreTimer: number | undefined;
    const handleOffline = () => {
      if (restoreTimer) window.clearTimeout(restoreTimer);
      setRestored(false);
      setOnline(false);
    };
    const handleOnline = () => {
      setOnline(true);
      setRestored(true);
      restoreTimer = window.setTimeout(() => setRestored(false), 3000);
    };
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      if (restoreTimer) window.clearTimeout(restoreTimer);
    };
  }, []);

  if (!online) {
    return <div className="connection-notice connection-offline print-hide" role="status" aria-live="polite"><strong>No network connection.</strong><span>Keep this screen open. StageWire will tell you when the device is back online; actions that need the server may not save until then.</span></div>;
  }
  if (restored) {
    return <div className="connection-notice connection-restored print-hide" role="status" aria-live="polite"><strong>Connection restored.</strong><span>You can retry anything that did not save.</span></div>;
  }
  return null;
}
