import { useEffect, useState } from 'react';

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

export function InstallAppNotice() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(() => isStandalone());
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem('stagewire-install-dismissed') === 'true',
  );
  const isAppleMobile = /iphone|ipad|ipod/i.test(navigator.userAgent);

  useEffect(() => {
    const handlePrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const handleInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handlePrompt);
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handlePrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  if (installed || dismissed || (!installPrompt && !isAppleMobile)) return null;

  const dismiss = () => {
    sessionStorage.setItem('stagewire-install-dismissed', 'true');
    setDismissed(true);
  };

  const install = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      setInstalled(true);
      setInstallPrompt(null);
    }
  };

  return (
    <aside className="install-app-notice print-hide" aria-label="Install StageWire">
      <div>
        <strong>Put StageWire on this phone.</strong>
        <span>
          {installPrompt
            ? 'Install it for a full-screen shortcut and faster access at the call.'
            : 'On iPhone or iPad, tap Share, then Add to Home Screen.'}
        </span>
      </div>
      <div className="install-app-actions">
        {installPrompt && <button className="btn btn-primary" type="button" onClick={install}>Install StageWire</button>}
        <button className="btn btn-quiet" type="button" onClick={dismiss}>Not now</button>
      </div>
    </aside>
  );
}
