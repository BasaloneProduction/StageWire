import { useEffect, useState } from 'react';
import { KeyRound, Link2, LogOut, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';

type SessionState = { authenticated: boolean };
type LinkedIdentity = { id: number; provider: string; createdAt: string };
type IdentityList = { identities: LinkedIdentity[] };

type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; message: string };

async function api<T>(path: string, options?: RequestInit): Promise<ApiResult<T>> {
  const response = await fetch(path, { credentials: 'same-origin', ...options });
  if (response.ok) {
    if (response.status === 204) return { ok: true, data: undefined as T };
    return { ok: true, data: await response.json() as T };
  }
  let message = `StageWire returned ${response.status}.`;
  try {
    const body = await response.json() as { error?: string };
    if (body.error) message = body.error;
  } catch {
    // Keep the status-based message when the response is not JSON.
  }
  return { ok: false, status: response.status, message };
}

function providerLabel(value: string) {
  const clean = value.trim();
  if (!clean) return 'Verified sign-in';
  return clean.split(/[-_]/).map((part) => part ? part[0].toUpperCase() + part.slice(1) : '').join(' ');
}

function dateLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Linked previously';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

export default function AccountSecurityPage() {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [identities, setIdentities] = useState<LinkedIdentity[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setError('');
    const session = await api<SessionState>('/api/auth/session');
    if (!session.ok) {
      if (session.status === 404) {
        setAvailable(false);
        setAuthenticated(false);
        setIdentities([]);
        return;
      }
      setAvailable(true);
      setAuthenticated(false);
      setIdentities([]);
      setError(session.message);
      return;
    }
    setAvailable(true);
    setAuthenticated(session.data.authenticated);
    if (!session.data.authenticated) {
      setIdentities([]);
      return;
    }
    const linked = await api<IdentityList>('/api/auth/identities');
    if (!linked.ok) {
      setError(linked.message);
      return;
    }
    setIdentities(linked.data.identities);
  };

  useEffect(() => { void load(); }, []);

  const signOut = async (everywhere = false) => {
    setBusy(everywhere ? 'everywhere' : 'device');
    setError('');
    setMessage('');
    const result = await api<void>(everywhere ? '/api/auth/sessions' : '/api/auth/session', { method: 'DELETE' });
    setBusy(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setAuthenticated(false);
    setIdentities([]);
    setMessage(everywhere ? 'Signed out everywhere.' : 'Signed out on this device.');
  };

  const unlink = async (identity: LinkedIdentity) => {
    if (identities.length <= 1) return;
    if (!window.confirm(`Remove ${providerLabel(identity.provider)} from this StageWire account?`)) return;
    setBusy(`identity-${identity.id}`);
    setError('');
    setMessage('');
    const result = await api<void>(`/api/auth/identities/${identity.id}`, { method: 'DELETE' });
    setBusy(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setMessage(`${providerLabel(identity.provider)} removed.`);
    await load();
  };

  return <div className="page-wrap">
    <div className="page-heading">
      <div><div className="eyebrow">Worker account</div><h1 style={{ marginTop: 10 }}>Account &amp; Security</h1><p className="subtitle">Your sign-ins and sessions should protect the worker record without ever exposing StageWire's internal owner ID.</p></div>
      <span className="badge badge-finished"><ShieldCheck size={16} /> Private account controls</span>
    </div>

    {message && <div className="success-box" role="status"><ShieldCheck size={20} /> {message}</div>}
    {error && <div className="error-box" role="alert"><KeyRound size={20} /><div><strong>Account action did not finish.</strong><p>{error}</p></div></div>}

    {available === null && <section className="card card-pad"><div className="eyebrow">Checking account layer</div><p className="subtitle" style={{ marginTop: 8 }}>StageWire is checking whether authenticated account controls are enabled on this build.</p></section>}

    {available === false && <section className="card card-pad"><div className="eyebrow">Preview build</div><h2 style={{ marginTop: 7 }}>Real worker login is intentionally not mounted yet.</h2><p className="subtitle">The account and session backend is built, but this preview stays blocked from pretending to be secure until a real identity provider verifies the worker. Do not enter real sensitive information into a shared preview.</p><div className="form-actions" style={{ marginTop: 18 }}><button className="btn btn-secondary" onClick={() => void load()}><RefreshCw size={18} /> Check again</button></div></section>}

    {available === true && !authenticated && <section className="card card-pad"><div className="eyebrow">Signed out</div><h2 style={{ marginTop: 7 }}>No StageWire session is active.</h2><p className="subtitle">Sign-in buttons will come from the verified identity provider when production authentication is mounted. StageWire will not accept an owner ID from the browser as a shortcut.</p></section>}

    {available === true && authenticated && <>
      <section className="card card-pad">
        <div className="eyebrow">Linked sign-ins</div><h2 style={{ marginTop: 7 }}>Ways you can get back into StageWire</h2><p className="subtitle">You can remove a linked login only when another login remains. StageWire refuses to strand the worker by deleting the final sign-in method.</p>
        <div className="experience-list" style={{ marginTop: 18 }}>
          {identities.map((identity) => <div className="experience-row" key={identity.id}><span><b><Link2 size={16} style={{ verticalAlign: '-3px', marginRight: 7 }} />{providerLabel(identity.provider)}</b><small>Linked {dateLabel(identity.createdAt)}</small></span><button className="btn btn-quiet" disabled={identities.length <= 1 || busy === `identity-${identity.id}`} onClick={() => void unlink(identity)}>{busy === `identity-${identity.id}` ? 'Removing…' : <><Trash2 size={16} /> Remove</>}</button></div>)}
        </div>
        {identities.length <= 1 && <p className="help-text" style={{ marginTop: 14 }}>This is your only login method, so StageWire keeps it linked.</p>}
      </section>

      <section className="card card-pad" style={{ marginTop: 22 }}>
        <div className="eyebrow">Sessions</div><h2 style={{ marginTop: 7 }}>Sign out controls</h2><p className="subtitle">Use this device only for a normal logout. Use sign out everywhere if a phone, laptop, or shared browser is lost or no longer trusted.</p><div className="form-actions" style={{ marginTop: 18 }}><button className="btn btn-secondary" disabled={Boolean(busy)} onClick={() => void signOut(false)}><LogOut size={18} /> {busy === 'device' ? 'Signing out…' : 'Sign out this device'}</button><button className="btn btn-quiet" disabled={Boolean(busy)} onClick={() => { if (window.confirm('Sign out every StageWire session on every device?')) void signOut(true); }}><ShieldCheck size={18} /> {busy === 'everywhere' ? 'Signing out…' : 'Sign out everywhere'}</button></div>
      </section>
    </>}
  </div>;
}
