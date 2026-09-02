import { useEffect, useState, type FormEvent } from 'react';
import { CheckCircle2, KeyRound, Link2, LogOut, Mail, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';

type AuthReadiness = {
  mode: 'preview' | 'production';
  signInAvailable: boolean;
  recordsFollowSignIn: boolean;
  provider: string | null;
};
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

export function AccountSecurityPanel() {
  const [readiness, setReadiness] = useState<AuthReadiness | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [identities, setIdentities] = useState<LinkedIdentity[]>([]);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setError('');
    const ready = await api<AuthReadiness>('/api/auth/readiness');
    if (!ready.ok) {
      setReadiness(null);
      setAuthenticated(false);
      setIdentities([]);
      setError(ready.message);
      return;
    }

    setReadiness(ready.data);
    if (!ready.data.signInAvailable) {
      setAuthenticated(false);
      setIdentities([]);
      return;
    }

    const session = await api<SessionState>('/api/auth/session');
    if (!session.ok) {
      setAuthenticated(false);
      setIdentities([]);
      setError(session.message);
      return;
    }
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

  const sendCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy('send-code');
    setError('');
    setMessage('');
    const result = await api<{ sent: boolean }>('/api/auth/email/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    setBusy(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setEmailSent(true);
    setMessage('Sign-in code sent. Check your email.');
  };

  const verifyCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy('verify-code');
    setError('');
    setMessage('');
    const result = await api<{ authenticated: boolean; created: boolean }>('/api/auth/email/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, token: code }),
    });
    setBusy(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setCode('');
    setEmailSent(false);
    setMessage(result.data.created ? 'Worker account created and signed in.' : 'Signed in. Your worker records can follow you.');
    await load();
  };

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

  const available = readiness?.signInAvailable ?? null;

  return <section id="account-security" className="setup-section" aria-labelledby="account-security-title">
    <div className="setup-section-head"><span className="setup-step"><ShieldCheck size={18} /></span><div><div className="eyebrow">Account &amp; security</div><h2 id="account-security-title">Protect the worker record.</h2><p className="subtitle">Sign-ins and sessions should belong to you without exposing StageWire's internal owner ID.</p></div></div>

    {message && <div className="success-box" role="status"><ShieldCheck size={20} /> {message}</div>}
    {error && <div className="error-box" role="alert"><KeyRound size={20} /><div><strong>Account check did not finish.</strong><p>{error}</p></div></div>}

    {readiness === null && !error && <div className="card card-pad"><div className="eyebrow">Checking account layer</div><p className="help-text" style={{ marginTop: 8 }}>StageWire is checking whether verified sign-in and cross-device records are enabled on this build.</p></div>}

    {available === false && <div className="card card-pad">
      <div className="eyebrow">Preview only</div>
      <h3 style={{ marginTop: 7 }}>This is not a portable worker account yet.</h3>
      <p className="help-text">Records in this preview are not attached to a verified person and are not guaranteed to follow you to another device. Use sample information only.</p>
      <div className="experience-list" style={{ marginTop: 16 }}>
        <div className="experience-row"><span><b><CheckCircle2 size={17} style={{ verticalAlign: '-3px', marginRight: 7 }} />Private worker ownership</b><small>Built into the database</small></span><strong>Ready</strong></div>
        <div className="experience-row"><span><b><CheckCircle2 size={17} style={{ verticalAlign: '-3px', marginRight: 7 }} />Secure session controls</b><small>Sign out one device or every device</small></span><strong>Ready</strong></div>
        <div className="experience-row"><span><b><KeyRound size={17} style={{ verticalAlign: '-3px', marginRight: 7 }} />Verified sign-in service</b><small>Required before records can safely follow a worker</small></span><strong>Not connected</strong></div>
      </div>
      <div className="privacy-rule" style={{ marginTop: 16 }}><ShieldCheck size={20} /><strong>StageWire will not fake a login or accept an owner ID from the browser.</strong></div>
      <div className="form-actions" style={{ marginTop: 14 }}><button type="button" className="btn btn-secondary" onClick={() => void load()}><RefreshCw size={18} /> Check again</button></div>
    </div>}

    {available === true && !authenticated && <div className="card card-pad">
      <div className="eyebrow">Verified worker sign-in</div>
      <h3 style={{ marginTop: 7 }}>Use a code from your email.</h3>
      <p className="help-text">No StageWire password to remember. Enter your email, then type the six-digit code we send.</p>
      <form onSubmit={sendCode} className="form-grid" style={{ marginTop: 18 }}>
        <div className="field full"><label htmlFor="stagewire-signin-email">Email</label><input id="stagewire-signin-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></div>
        <div className="field full"><button type="submit" className="btn btn-primary" disabled={Boolean(busy)}><Mail size={18} /> {busy === 'send-code' ? 'Sending…' : emailSent ? 'Send another code' : 'Send sign-in code'}</button></div>
      </form>
      {emailSent && <form onSubmit={verifyCode} className="form-grid" style={{ marginTop: 18 }}>
        <div className="field full"><label htmlFor="stagewire-signin-code">Six-digit code</label><input id="stagewire-signin-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} /></div>
        <div className="field full"><button type="submit" className="btn btn-primary" disabled={Boolean(busy) || code.length !== 6}><KeyRound size={18} /> {busy === 'verify-code' ? 'Verifying…' : 'Verify and continue'}</button></div>
      </form>}
      <div className="privacy-rule" style={{ marginTop: 18 }}><ShieldCheck size={20} /><strong>The provider verifies the email; StageWire stores only its stable account ID and a protected session.</strong></div>
    </div>}

    {available === true && authenticated && <div className="account-security-grid">
      <div className="card card-pad">
        <div className="eyebrow">Linked sign-ins</div><h3 style={{ marginTop: 7 }}>Ways you can get back into StageWire</h3><p className="help-text">You can remove a linked login only when another login remains.</p>
        <div className="experience-list" style={{ marginTop: 16 }}>{identities.map((identity) => <div className="experience-row" key={identity.id}><span><b><Link2 size={16} style={{ verticalAlign: '-3px', marginRight: 7 }} />{providerLabel(identity.provider)}</b><small>Linked {dateLabel(identity.createdAt)}</small></span><button type="button" className="btn btn-quiet" disabled={identities.length <= 1 || busy === `identity-${identity.id}`} onClick={() => void unlink(identity)}>{busy === `identity-${identity.id}` ? 'Removing…' : <><Trash2 size={16} /> Remove</>}</button></div>)}</div>
        {identities.length <= 1 && <p className="help-text" style={{ marginTop: 12 }}>This is your only login method, so StageWire keeps it linked.</p>}
      </div>

      <div className="card card-pad">
        <div className="eyebrow">Sessions</div><h3 style={{ marginTop: 7 }}>Sign out controls</h3><p className="help-text">Use sign out everywhere if a phone, laptop, or shared browser is lost or no longer trusted.</p><div className="form-actions" style={{ marginTop: 16 }}><button type="button" className="btn btn-secondary" disabled={Boolean(busy)} onClick={() => void signOut(false)}><LogOut size={18} /> {busy === 'device' ? 'Signing out…' : 'Sign out this device'}</button><button type="button" className="btn btn-quiet" disabled={Boolean(busy)} onClick={() => { if (window.confirm('Sign out every StageWire session on every device?')) void signOut(true); }}><ShieldCheck size={18} /> {busy === 'everywhere' ? 'Signing out…' : 'Sign out everywhere'}</button></div>
      </div>
    </div>}
  </section>;
}

export default function AccountSecurityPage() {
  return <div className="page-wrap"><div className="page-heading"><div><div className="eyebrow">Worker account</div><h1 style={{ marginTop: 10 }}>Account &amp; Security</h1><p className="subtitle">Your sign-ins and sessions stay tied to your private worker record.</p></div></div><AccountSecurityPanel /></div>;
}
