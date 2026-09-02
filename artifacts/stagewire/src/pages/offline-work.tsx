import { useEffect, useState } from 'react';
import { CheckCircle2, RefreshCw, ShieldCheck, Trash2, WifiOff } from 'lucide-react';
import { Link } from 'wouter';
import {
  discardOfflineOutboxAction,
  listOfflineOutboxActions,
  replayOfflineOutbox,
  subscribeToOfflineOutbox,
  type OfflineOutboxAction,
} from '@/offline-outbox';

function savedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Saved on this device';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export default function OfflineWorkPage() {
  const [actions, setActions] = useState<OfflineOutboxAction[]>(() => listOfflineOutboxActions());
  const [online, setOnline] = useState(() => navigator.onLine);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const refresh = () => setActions(listOfflineOutboxActions());

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    const unsubscribe = subscribeToOfflineOutbox((detail) => {
      refresh();
      if (detail.synced) {
        setMessage(`${detail.synced} saved action${detail.synced === 1 ? '' : 's'} uploaded.`);
      }
      if (detail.rejected) {
        setMessage(`${detail.rejected} action${detail.rejected === 1 ? '' : 's'} could not be applied. Review the active call before entering anything again.`);
      }
    });
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      unsubscribe();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const retry = async () => {
    setBusy(true);
    setMessage('');
    await replayOfflineOutbox();
    refresh();
    setBusy(false);
  };

  const remove = (action: OfflineOutboxAction) => {
    if (!window.confirm(`Remove this saved ${action.label.toLowerCase()}? It will not be uploaded to the worker record.`)) return;
    discardOfflineOutboxAction(action.id);
    setMessage(`${action.label} removed from this device.`);
    refresh();
  };

  return (
    <div className="page-wrap">
      <div className="page-heading">
        <div>
          <div className="eyebrow">Worker-controlled offline storage</div>
          <h1 style={{ marginTop: 10 }}>Saved for signal</h1>
          <p className="subtitle">Review workday actions held on this device before StageWire uploads them.</p>
        </div>
        <Link href="/calls" className="btn btn-quiet">Back to Calls</Link>
      </div>

      <div className="privacy-rule" style={{ marginBottom: 22 }}>
        <ShieldCheck size={21} />
        <span>Only the action needed for the worker record is held here. Sign-in headers and cookies are never stored in the outbox.</span>
      </div>

      {!online && (
        <div className="warning-box" role="status">
          <WifiOff size={22} />
          <div><strong>No signal right now.</strong><p>Your saved actions remain on this device until the connection returns or you remove them.</p></div>
        </div>
      )}

      {message && <div className="success-box" role="status"><CheckCircle2 size={21} /> {message}</div>}

      {actions.length === 0 ? (
        <div className="card card-pad empty">
          <div className="empty-mark"><CheckCircle2 size={25} /></div>
          <h2>Nothing is waiting.</h2>
          <p style={{ marginTop: 8 }}>All saved workday actions have been uploaded or removed.</p>
        </div>
      ) : (
        <div className="card card-pad">
          <div className="section-label">
            <div><div className="eyebrow">Waiting on this device</div><h2>{actions.length} saved action{actions.length === 1 ? '' : 's'}</h2></div>
            <button className="btn btn-primary" type="button" disabled={!online || busy} onClick={() => void retry()}>
              <RefreshCw size={19} /> {busy ? 'Uploading…' : 'Upload now'}
            </button>
          </div>
          <div className="experience-list" style={{ marginTop: 18 }}>
            {actions.map((action) => (
              <div className="experience-row" key={action.id}>
                <span><b>{action.label}</b><small>Saved {savedAt(action.createdAt)}</small></span>
                <button className="btn btn-quiet" type="button" onClick={() => remove(action)}>
                  <Trash2 size={17} /> Remove
                </button>
              </div>
            ))}
          </div>
          <p className="help-text" style={{ marginTop: 16 }}>StageWire uploads these in the order you saved them. Removing one cannot be undone.</p>
        </div>
      )}
    </div>
  );
}
