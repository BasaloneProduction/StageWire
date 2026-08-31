import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  Archive,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  CalendarDays,
  Camera,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileText,
  LayoutDashboard,
  LockKeyhole,
  MapPin,
  Menu,
  Plus,
  ReceiptText,
  RefreshCw,
  Save,
  ShieldCheck,
  Timer,
  UserRound,
  X,
} from 'lucide-react';
import {
  getGetCallQueryKey,
  getGetDashboardQueryKey,
  getGetPassportQueryKey,
  getGetProfileQueryKey,
  getGetVaultQueryKey,
  getListCallsQueryKey,
  useCreateCall,
  useFinishCall,
  useGetCall,
  useGetDashboard,
  useGetPassport,
  useGetProfile,
  useGetVault,
  useHealthCheck,
  useListCalls,
  useUpdateProfile,
  type Call,
  type CallInput,
  type FinishCallInput,
  type ProfileInput,
} from '@workspace/api-client-react';
import { Link, Route, Switch, Router as WouterRouter, useLocation, useParams } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();

function formatDate(value: string | null | undefined, options: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' }) {
  if (!value) return 'Not set';
  const date = new Date(`${value.includes('T') ? value : `${value}T12:00:00`}`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-US', options).format(date);
}

function formatTime(value: string | null | undefined) {
  if (!value) return 'Time not set';
  const date = new Date(value.includes('T') ? value : `2000-01-01T${value}`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(date);
}

function money(value: number | null | undefined) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value ?? 0);
}

function initials(name: string | undefined) {
  return (name || 'SW').split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
}

function dataError(message: string | undefined) {
  return message || 'The signal dropped before we could load this.';
}

function ErrorState({ message, onRetry }: { message?: string; onRetry: () => void }) {
  return (
    <div className="error-box" role="alert" data-testid="status-error">
      <AlertCircle size={23} aria-hidden="true" />
      <div>
        <strong>Could not load that.</strong>
        <p>{dataError(message)}</p>
        <button className="btn btn-quiet" style={{ marginTop: 12 }} onClick={onRetry} data-testid="button-retry">
          <RefreshCw size={17} /> Try again
        </button>
      </div>
    </div>
  );
}

function LoadingState({ rows = 4 }: { rows?: number }) {
  return (
    <div className="calls-list" aria-label="Loading" data-testid="status-loading">
      {Array.from({ length: rows }).map((_, index) => (
        <div className="card call-card" key={index}>
          <div className="skeleton" style={{ height: 65 }} />
          <div><div className="skeleton" style={{ height: 22, width: '65%', marginBottom: 12 }} /><div className="skeleton" style={{ height: 17, width: '44%' }} /></div>
          <div className="skeleton" style={{ height: 42, width: 92 }} />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ title, detail, action }: { title: string; detail: string; action?: ReactNode }) {
  return (
    <div className="card empty" data-testid="status-empty">
      <div className="empty-mark"><Archive size={25} /></div>
      <h3>{title}</h3>
      <p style={{ marginTop: 8 }}>{detail}</p>
      {action && <div style={{ marginTop: 20 }}>{action}</div>}
    </div>
  );
}

function AppShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [largeType, setLargeType] = useState(() => localStorage.getItem('stagewire-large-type') === 'true');
  const profile = useGetProfile();
  const health = useHealthCheck();

  useEffect(() => {
    document.documentElement.classList.toggle('large-type', largeType);
    localStorage.setItem('stagewire-large-type', String(largeType));
  }, [largeType]);

  const displayName = profile.data?.displayName || 'Worker profile';
  const nav = [
    { href: '/', label: 'Home base', icon: LayoutDashboard },
    { href: '/calls', label: 'Calls', icon: CalendarDays },
    { href: '/vault', label: 'Vault', icon: Archive },
    { href: '/profile', label: 'Profile', icon: UserRound },
    { href: '/passport', label: 'Career Passport', icon: BadgeCheck },
  ];

  return (
    <div className="app-shell">
      <aside className={`side-rail ${menuOpen ? 'open' : ''}`} aria-label="Main navigation">
        <Link href="/" className="brand-lockup" onClick={() => setMenuOpen(false)} data-testid="link-brand">
          <span className="brand-mark">sw</span><span className="brand-word">stagewire</span>
        </Link>
        <div className="rail-kicker">Your working set</div>
        <nav className="nav-stack">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`nav-link ${location === href ? 'active' : ''}`}
              onClick={() => setMenuOpen(false)}
              data-testid={`link-${label.toLowerCase().replaceAll(' ', '-')}`}
            >
              <Icon size={20} strokeWidth={1.8} aria-hidden="true" /><span>{label}</span>
            </Link>
          ))}
        </nav>
        <div className="rail-bottom">
          <div className="rail-status" data-testid="status-health">
            <span className="status-dot" style={{ background: health.isError ? '#ed856e' : undefined }} />
            {health.isLoading ? 'Checking signal' : health.isError ? 'Offline mode' : 'System ready'}
          </div>
          <div style={{ color: 'hsl(43 20% 68%)', fontSize: '.78rem', marginTop: 9 }}>{displayName}</div>
        </div>
      </aside>
      {menuOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMenuOpen(false)} data-testid="button-close-nav" />}
      <main className="main-area">
        <header className="topbar">
          <button className="icon-btn mobile-menu" onClick={() => setMenuOpen(true)} aria-label="Open navigation" data-testid="button-open-nav"><Menu size={22} /></button>
          <div className="topbar-spacer" />
          <button
            className={`btn ${largeType ? 'btn-primary' : 'btn-quiet'}`}
            onClick={() => setLargeType((current) => !current)}
            aria-pressed={largeType}
            data-testid="button-larger-text"
          >
            <span className="mono" style={{ fontSize: '.88rem' }}>A+</span> {largeType ? 'Larger text on' : 'Larger text'}
          </button>
          <div className="avatar" style={{ width: 44, height: 44, fontSize: '1rem', margin: 0 }} aria-label={displayName} data-testid="avatar-worker">{initials(displayName)}</div>
        </header>
        <div className="page-enter">{children}</div>
      </main>
    </div>
  );
}

function DashboardPage() {
  const dashboard = useGetDashboard();
  const summary = dashboard.data;
  if (dashboard.isLoading) return <PageFrame><LoadingState rows={3} /></PageFrame>;
  if (dashboard.isError) return <PageFrame><ErrorState message={(dashboard.error as Error)?.message} onRetry={() => dashboard.refetch()} /></PageFrame>;
  const upcoming = summary?.upcomingCall;
  return (
    <PageFrame>
      <div className="page-heading">
        <div><div className="eyebrow">Home base / {formatDate(new Date().toISOString(), { month: 'long', day: 'numeric', year: 'numeric' })}</div><h1 style={{ marginTop: 10 }}>Ready when<br />the call is.</h1><p className="subtitle">One clear place for the work ahead, the hours behind you, and what needs closing out.</p></div>
      </div>
      {upcoming ? (
        <section className="dashboard-hero" data-testid="card-next-call">
          <div>
            <div className="hero-topline"><span className="hero-tag">Next call</span><span className="hero-date">{formatDate(upcoming.workDate)}</span></div>
            <h2 data-testid="text-upcoming-show">{upcoming.showName}</h2>
            <div className="hero-detail">
              <span><strong>{upcoming.venue}</strong><MapPin size={15} style={{ verticalAlign: '-2px', marginRight: 5 }} />Venue</span>
              <span><strong>{upcoming.role}</strong><BriefcaseBusiness size={15} style={{ verticalAlign: '-2px', marginRight: 5 }} />Call role</span>
              <span><strong>{formatTime(upcoming.scheduledStart)}</strong><Clock3 size={15} style={{ verticalAlign: '-2px', marginRight: 5 }} />Start time</span>
            </div>
          </div>
          <div className="hero-actions">
            <Link href={`/finish?call=${upcoming.id}`} className="btn btn-primary" data-testid={`link-finish-call-${upcoming.id}`}>Finish this call <ArrowRight size={18} /></Link>
            <Link href="/calls" className="btn btn-secondary" data-testid="link-all-calls">See all calls</Link>
          </div>
        </section>
      ) : (
        <EmptyState title="The board is clear." detail="Add your next call when the details land." action={<Link href="/calls" className="btn btn-primary" data-testid="link-add-first-call"><Plus size={18} /> Add a call</Link>} />
      )}
      <div className="stats-grid">
        <Stat label="Upcoming calls" value={summary?.upcomingCount ?? 0} />
        <Stat label="Completed calls" value={summary?.completedCount ?? 0} />
        <Stat label="Hours this month" value={`${summary?.hoursThisMonth ?? 0}h`} />
        <Stat label="Gross this month" value={money(summary?.grossThisMonth)} accent />
      </div>
      <div className="section-label"><h2>Keep moving</h2><Link href="/vault" className="link-text" data-testid="link-home-vault">Open your Vault <ChevronRight size={16} style={{ verticalAlign: '-3px' }} /></Link></div>
      <div className="card card-pad" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 18 }}>
        <QuickLink href="/calls" icon={<Timer size={22} />} title="Log the work" detail="Add or finish a call" testId="link-quick-calls" />
        <QuickLink href="/passport" icon={<BadgeCheck size={22} />} title="Know your record" detail="Review your Passport" testId="link-quick-passport" />
        <QuickLink href="/profile" icon={<UserRound size={22} />} title="Keep it current" detail="Update your profile" testId="link-quick-profile" />
      </div>
    </PageFrame>
  );
}

function Stat({ label, value, accent = false }: { label: string; value: string | number; accent?: boolean }) {
  return <div className={`card stat-card ${accent ? 'stat-accent' : ''}`} data-testid={`stat-${label.toLowerCase().replaceAll(' ', '-')}`}><span className="stat-label">{label}</span><strong className="stat-value">{value}</strong></div>;
}

function QuickLink({ href, icon, title, detail, testId }: { href: string; icon: ReactNode; title: string; detail: string; testId: string }) {
  return <Link href={href} className="quick-link" data-testid={testId}><span className="quick-icon">{icon}</span><span><strong>{title}</strong><small>{detail}</small></span><ArrowRight size={18} /></Link>;
}

function CallsPage() {
  const calls = useListCalls();
  const createCall = useCreateCall();
  const client = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'finished'>('all');
  const [showForm, setShowForm] = useState(false);
  const [saved, setSaved] = useState(false);
  const visibleCalls = useMemo(() => {
    const values = calls.data ?? [];
    return filter === 'all' ? values : values.filter((call) => call.status === filter);
  }, [calls.data, filter]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload: CallInput = {
      venue: String(form.get('venue') || ''),
      showName: String(form.get('showName') || ''),
      workDate: String(form.get('workDate') || ''),
      scheduledStart: String(form.get('scheduledStart') || '') || null,
      role: String(form.get('role') || ''),
      hourlyRate: Number(form.get('hourlyRate') || 0),
    };
    createCall.mutate({ data: payload }, {
      onSuccess: () => {
        client.invalidateQueries({ queryKey: getListCallsQueryKey() });
        client.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
        setShowForm(false); setSaved(true); event.currentTarget.reset();
        window.setTimeout(() => setSaved(false), 3500);
      },
    });
  };

  return (
    <PageFrame>
      <div className="page-heading"><div><div className="eyebrow">Work log</div><h1 style={{ marginTop: 10 }}>Calls</h1><p className="subtitle">Your upcoming calls and finished work, all in one readable run sheet.</p></div><button className="btn btn-primary" onClick={() => setShowForm(true)} data-testid="button-add-call"><Plus size={20} /> Add a call</button></div>
      {saved && <div className="success-box" role="status" data-testid="status-call-saved"><CheckCircle2 size={22} /><span>Call added to your working set.</span></div>}
      <div className="toolbar"><div className="tabs" role="tablist" aria-label="Filter calls">{(['all', 'upcoming', 'finished'] as const).map((value) => <button key={value} className={`tab ${filter === value ? 'active' : ''}`} role="tab" aria-selected={filter === value} onClick={() => setFilter(value)} data-testid={`tab-calls-${value}`}>{value === 'all' ? 'All calls' : value === 'upcoming' ? 'Upcoming' : 'Finished'}</button>)}</div><span className="help-text">{visibleCalls.length} {visibleCalls.length === 1 ? 'call' : 'calls'}</span></div>
      {showForm && <AddCallForm onCancel={() => setShowForm(false)} onSubmit={submit} pending={createCall.isPending} error={createCall.error as Error | null} />}
      {calls.isLoading ? <LoadingState /> : calls.isError ? <ErrorState message={(calls.error as Error)?.message} onRetry={() => calls.refetch()} /> : visibleCalls.length === 0 ? <EmptyState title={filter === 'all' ? 'No calls yet.' : `No ${filter} calls.`} detail={filter === 'all' ? 'Build your run sheet with the next job that comes in.' : 'Try another view or add a new call.'} action={filter === 'all' ? <button className="btn btn-primary" onClick={() => setShowForm(true)} data-testid="button-empty-add-call"><Plus size={18} /> Add a call</button> : undefined} /> : <div className="calls-list">{visibleCalls.map((call) => <CallCard key={call.id} call={call} />)}</div>}
    </PageFrame>
  );
}

function AddCallForm({ onCancel, onSubmit, pending, error }: { onCancel: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; pending: boolean; error: Error | null }) {
  return <div className="modal-surface" role="dialog" aria-modal="true" aria-labelledby="add-call-title"><div className="modal-dialog card"><div className="modal-head"><div><div className="eyebrow">New entry</div><h2 id="add-call-title" style={{ marginTop: 7 }}>Add a call</h2></div><button className="icon-btn" onClick={onCancel} aria-label="Close add call" data-testid="button-close-add-call"><X size={21} /></button></div><form onSubmit={onSubmit} className="card-pad"><div className="form-grid"><Field label="Show or event" name="showName" placeholder="e.g. Halcyon / load-in" required /><Field label="Venue" name="venue" placeholder="e.g. The Fillmore" required /><Field label="Work date" name="workDate" type="date" required /><Field label="Scheduled start" name="scheduledStart" type="time" /><Field label="Role on the call" name="role" placeholder="e.g. Rigger" required /><Field label="Hourly rate" name="hourlyRate" type="number" min="0" step="0.01" placeholder="0.00" /></div>{error && <div className="error-box" style={{ marginTop: 20 }} role="alert"><AlertCircle size={20} /> {error.message || 'Call could not be added.'}</div>}<div className="form-actions"><button className="btn btn-primary" disabled={pending} type="submit" data-testid="button-submit-call">{pending ? 'Saving call…' : <><Save size={18} /> Save call</>}</button><button className="btn btn-quiet" type="button" onClick={onCancel} data-testid="button-cancel-call">Cancel</button></div></form></div></div>;
}

function Field({ label, name, type = 'text', placeholder, required = false, min, step, defaultValue }: { label: string; name: string; type?: string; placeholder?: string; required?: boolean; min?: string; step?: string; defaultValue?: string | number }) {
  return <div className="field"><label htmlFor={name}>{label}{required && <span aria-hidden="true"> *</span>}</label><input id={name} name={name} type={type} placeholder={placeholder} required={required} min={min} step={step} defaultValue={defaultValue} data-testid={`input-${name}`} /></div>;
}

function CallCard({ call }: { call: Call }) {
  const callDate = new Date(call.workDate.includes('T') ? call.workDate : `${call.workDate}T12:00:00`);
  return <div className="card call-card" data-testid={`card-call-${call.id}`}><div className="date-block"><strong className="date-day">{callDate.getDate()}</strong><span className="date-month">{new Intl.DateTimeFormat('en-US', { month: 'short' }).format(callDate)}</span></div><div className="call-main"><div className="call-title" data-testid={`text-call-show-${call.id}`}>{call.showName}</div><div className="call-meta"><MapPin size={15} style={{ verticalAlign: '-2px', marginRight: 4 }} />{call.venue} <span aria-hidden="true">·</span> {call.role} <span aria-hidden="true">·</span> {formatTime(call.scheduledStart)}</div>{call.status === 'finished' && <div className="call-meta mono" style={{ color: 'hsl(var(--accent))', marginTop: 8 }}>{call.hours}h / {money(call.gross)}</div>}</div><div className="call-card-actions"><span className={`badge badge-${call.status}`}>{call.status}</span>{call.status === 'upcoming' ? <Link href={`/finish?call=${call.id}`} className="btn btn-primary" data-testid={`link-finish-${call.id}`}>Finish <ArrowRight size={17} /></Link> : <Link href={`/receipt/${call.id}`} className="btn btn-quiet" data-testid={`link-receipt-${call.id}`}>Receipt</Link>}</div></div>;
}

function FinishPage() {
  const calls = useListCalls();
  const client = useQueryClient();
  const finishCall = useFinishCall();
  const queryId = Number(new URLSearchParams(window.location.search).get('call'));
  const selectedId = Number.isFinite(queryId) && queryId > 0 ? queryId : calls.data?.find((call) => call.status === 'upcoming')?.id;
  const selected = calls.data?.find((call) => call.id === selectedId);
  const callQuery = useGetCall(selectedId ?? 0, { query: { enabled: Boolean(selectedId), queryKey: getGetCallQueryKey(selectedId ?? 0) } });
  const call = callQuery.data || selected;
  const [done, setDone] = useState(false);
  const [, setLocation] = useLocation();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedId) return;
    const form = new FormData(event.currentTarget);
    const payload: FinishCallInput = {
      actualStart: String(form.get('actualStart') || ''),
      actualEnd: String(form.get('actualEnd') || ''),
      breakMinutes: Number(form.get('breakMinutes') || 0),
      role: String(form.get('role') || ''),
      expenseAmount: Number(form.get('expenseAmount') || 0),
      expenseDescription: String(form.get('expenseDescription') || '') || null,
      note: String(form.get('note') || '') || null,
      receiptAttachmentName: String(form.get('receiptAttachmentName') || '') || null,
      workPhotoName: String(form.get('workPhotoName') || '') || null,
    };
    finishCall.mutate({ id: selectedId, data: payload }, {
      onSuccess: (result) => {
        client.invalidateQueries({ queryKey: getListCallsQueryKey() });
        client.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
        client.invalidateQueries({ queryKey: getGetVaultQueryKey() });
        client.invalidateQueries({ queryKey: getGetPassportQueryKey() });
        client.setQueryData(getGetCallQueryKey(selectedId), result);
        setDone(true);
        window.setTimeout(() => setLocation(`/receipt/${result.id}`), 850);
      },
    });
  };

  if (calls.isLoading || callQuery.isLoading) return <PageFrame><LoadingState rows={2} /></PageFrame>;
  if (calls.isError || callQuery.isError) return <PageFrame><ErrorState message={(calls.error as Error)?.message || (callQuery.error as Error)?.message} onRetry={() => { calls.refetch(); callQuery.refetch(); }} /></PageFrame>;
  if (!call || !selectedId) return <PageFrame><EmptyState title="No open call to finish." detail="Add or select an upcoming call before closing out the work." action={<Link href="/calls" className="btn btn-primary" data-testid="link-finish-empty-calls"><ArrowLeft size={18} /> Back to calls</Link>} /></PageFrame>;
  if (done) return <PageFrame><div className="success-box" role="status" data-testid="status-finish-success"><CheckCircle2 size={24} /><div><strong>Call finished.</strong><p>Your permanent receipt is ready. Opening it now.</p></div></div></PageFrame>;

  return <PageFrame><div className="page-heading"><div><Link href="/calls" className="link-text" data-testid="link-back-calls"><ArrowLeft size={17} /> Calls</Link><div className="eyebrow" style={{ marginTop: 24 }}>Close out / {formatDate(call.workDate)}</div><h1 style={{ marginTop: 10 }}>Finish the call.</h1><p className="subtitle">Capture the hours while they are fresh. This creates a permanent private receipt.</p></div></div><div className="card form-card card-pad"><div className="finish-context"><div><span className="eyebrow">Working on</span><h3 style={{ marginTop: 5 }}>{call.showName}</h3><p className="call-meta"><MapPin size={15} style={{ verticalAlign: '-2px', marginRight: 5 }} />{call.venue} · {call.role}</p></div><span className="badge badge-upcoming">Open call</span></div><form onSubmit={submit}><div className="form-grid"><Field label="Actual start" name="actualStart" type="datetime-local" required defaultValue={call.actualStart ? call.actualStart.slice(0, 16) : undefined} /><Field label="Actual end" name="actualEnd" type="datetime-local" required defaultValue={call.actualEnd ? call.actualEnd.slice(0, 16) : undefined} /><Field label="Break minutes" name="breakMinutes" type="number" min="0" step="1" defaultValue={call.breakMinutes || 0} /><Field label="Role on the call" name="role" required defaultValue={call.role} /><Field label="Expenses" name="expenseAmount" type="number" min="0" step="0.01" defaultValue={call.expenseAmount || 0} /><Field label="Expense description" name="expenseDescription" placeholder="Travel, materials, meals" defaultValue={call.expenseDescription || ''} /><div className="field full"><label htmlFor="note">Private note</label><textarea id="note" name="note" placeholder="What should you remember about this call?" defaultValue={call.note || ''} data-testid="input-note" /></div><Field label="Receipt attachment name" name="receiptAttachmentName" placeholder="e.g. invoice-042.pdf" defaultValue={call.receiptAttachmentName || ''} /><Field label="Work photo name" name="workPhotoName" placeholder="e.g. load-in.jpg" defaultValue={call.workPhotoName || ''} /></div>{finishCall.error && <div className="error-box" role="alert" style={{ marginTop: 20 }}><AlertCircle size={20} /> {(finishCall.error as Error).message || 'This call could not be finished.'}</div>}<div className="form-actions"><button className="btn btn-primary" type="submit" disabled={finishCall.isPending} data-testid="button-submit-finish">{finishCall.isPending ? 'Creating receipt…' : <><ReceiptText size={18} /> Finish & create receipt</>}</button><Link href="/calls" className="btn btn-quiet" data-testid="link-cancel-finish">Cancel</Link></div></form></div></PageFrame>;
}

function ReceiptPage() {
  const { id } = useParams<{ id: string }>();
  const callId = Number(id);
  const callQuery = useGetCall(callId, { query: { queryKey: getGetCallQueryKey(callId), enabled: Number.isFinite(callId) && callId > 0 } });
  const call = callQuery.data;
  if (callQuery.isLoading) return <PageFrame><LoadingState rows={1} /></PageFrame>;
  if (callQuery.isError || !call) return <PageFrame><ErrorState message={(callQuery.error as Error)?.message || 'That receipt is not available.'} onRetry={() => callQuery.refetch()} /></PageFrame>;
  return <PageFrame><div className="page-heading"><div><Link href="/calls" className="link-text" data-testid="link-receipt-back"><ArrowLeft size={17} /> Calls</Link><div className="eyebrow" style={{ marginTop: 24 }}>Permanent receipt / #{call.id}</div><h1 style={{ marginTop: 10 }}>Receipt</h1><p className="subtitle">Private by default. A clean record of the work you did.</p></div><button className="btn btn-quiet" onClick={() => window.print()} data-testid="button-print-receipt"><ReceiptText size={18} /> Print / save</button></div><article className="card card-pad receipt-paper" data-testid={`receipt-${call.id}`}><div className="receipt-head"><div><div className="eyebrow">StageWire work receipt</div><h2>{call.showName}</h2><p className="call-meta"><MapPin size={15} style={{ verticalAlign: '-2px', marginRight: 4 }} />{call.venue}</p></div><div><div className="receipt-label">Gross estimated pay</div><div className="receipt-total" data-testid={`text-receipt-gross-${call.id}`}>{money(call.gross)}</div></div></div><div className="receipt-grid"><ReceiptDatum label="Work date" value={formatDate(call.workDate, { month: 'long', day: 'numeric', year: 'numeric' })} /><ReceiptDatum label="Scheduled call time" value={formatTime(call.scheduledStart)} /><ReceiptDatum label="Role performed" value={call.role} /><ReceiptDatum label="Actual start" value={formatDate(call.actualStart, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} /><ReceiptDatum label="Actual end" value={formatDate(call.actualEnd, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} /><ReceiptDatum label="Break" value={`${call.breakMinutes} minutes`} /><ReceiptDatum label="Hours worked" value={`${call.hours} hours`} /><ReceiptDatum label="Hourly rate" value={money(call.hourlyRate)} /><ReceiptDatum label="Expenses" value={money(call.expenseAmount)} /><ReceiptDatum label="Expense details" value={call.expenseDescription || 'None logged'} /><ReceiptDatum label="Receipt status" value="Finished · locked in" /></div>{call.note && <div className="card" style={{ padding: 18, background: 'hsl(var(--muted))' }}><div className="receipt-label">Private note</div><p style={{ marginTop: 8 }}>{call.note}</p></div>}{(call.receiptAttachmentName || call.workPhotoName) && <div className="receipt-attachments"><div className="receipt-label">Attachments</div><div className="attachment-list">{call.receiptAttachmentName && <span className="attachment-pill"><FileText size={17} aria-hidden="true" />{call.receiptAttachmentName}</span>}{call.workPhotoName && <span className="attachment-pill"><Camera size={17} aria-hidden="true" />{call.workPhotoName}</span>}</div></div>}<div className="receipt-foot"><span><LockKeyhole size={15} style={{ verticalAlign: '-3px', marginRight: 5 }} />Private to you</span><span>Recorded in StageWire · #{call.id}</span></div></article></PageFrame>;
}

function ReceiptDatum({ label, value }: { label: string; value: string }) {
  return <div><div className="receipt-label">{label}</div><div className="receipt-value">{value}</div></div>;
}

function VaultPage() {
  const vault = useGetVault();
  if (vault.isLoading) return <PageFrame><LoadingState rows={3} /></PageFrame>;
  if (vault.isError || !vault.data) return <PageFrame><ErrorState message={(vault.error as Error)?.message} onRetry={() => vault.refetch()} /></PageFrame>;
  const data = vault.data;
  const sections = [
    { title: 'Work receipts', count: data.calls.length, icon: <ReceiptText size={25} />, items: data.calls.slice(0, 5).map((call) => ({ label: call.showName, detail: formatDate(call.workDate) })), href: '/calls' },
    { title: 'Certifications', count: data.certifications.length, icon: <ShieldCheck size={25} />, items: data.certifications.slice(0, 4).map((item) => ({ label: item, detail: 'Credential' })) },
    { title: 'Skills', count: data.skills.length, icon: <BriefcaseBusiness size={25} />, items: data.skills.slice(0, 4).map((item) => ({ label: item, detail: 'Capability' })) },
    { title: 'Documents', count: data.documents.length, icon: <FileText size={25} />, items: data.documents.slice(0, 4).map((item) => ({ label: item.name, detail: `Call #${item.callId}` })) },
    { title: 'Work photos', count: data.photos.length, icon: <Camera size={25} />, items: data.photos.slice(0, 4).map((item) => ({ label: item.name, detail: `Call #${item.callId}` })) },
  ];
  return <PageFrame><div className="page-heading"><div><div className="eyebrow">Worker-owned archive</div><h1 style={{ marginTop: 10 }}>The Vault</h1><p className="subtitle">Your receipts, credentials, and proof of work. Kept private, ready when you need it.</p></div><span className="badge badge-finished"><LockKeyhole size={14} /> Private archive</span></div><div className="vault-grid">{sections.map((section, index) => <div className={`card vault-card ${index === 0 ? 'large' : ''}`} key={section.title} data-testid={`vault-${section.title.toLowerCase().replaceAll(' ', '-')}`}><div className="vault-icon">{section.icon}</div><h3>{section.title}</h3><strong className="vault-count">{section.count}</strong>{section.items.length > 0 ? <div className="vault-items">{section.items.map((item, itemIndex) => <div className="vault-item" key={`${item.label}-${itemIndex}`}><span>{item.label}</span><span>{item.detail}</span></div>)}</div> : <p className="help-text" style={{ marginTop: 18 }}>Nothing here yet.</p>}{section.href && <Link href={section.href} className="link-text" style={{ marginTop: 18 }} data-testid={`link-vault-${index}`}>View work <ArrowRight size={16} style={{ verticalAlign: '-3px' }} /></Link>}</div>)}</div></PageFrame>;
}

function ProfilePage() {
  const profile = useGetProfile();
  const updateProfile = useUpdateProfile();
  const client = useQueryClient();
  const [saved, setSaved] = useState(false);
  if (profile.isLoading) return <PageFrame><LoadingState rows={2} /></PageFrame>;
  if (profile.isError || !profile.data) return <PageFrame><ErrorState message={(profile.error as Error)?.message} onRetry={() => profile.refetch()} /></PageFrame>;
  const worker = profile.data;
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload: ProfileInput = {
      displayName: String(form.get('displayName') || ''),
      homeCityState: String(form.get('homeCityState') || ''),
      phone: String(form.get('phone') || ''),
      email: String(form.get('email') || ''),
      primaryRole: String(form.get('primaryRole') || ''),
      additionalRoles: String(form.get('additionalRoles') || '').split(',').map((item) => item.trim()).filter(Boolean),
      yearsExperience: Number(form.get('yearsExperience') || 0),
      skills: String(form.get('skills') || '').split(',').map((item) => item.trim()).filter(Boolean),
      certifications: String(form.get('certifications') || '').split(',').map((item) => item.trim()).filter(Boolean),
      bio: String(form.get('bio') || '') || null,
      emergencyContact: String(form.get('emergencyContact') || '') || null,
      profilePhotoName: worker.profilePhotoName,
    };
    updateProfile.mutate({ data: payload }, { onSuccess: (result) => { client.setQueryData(getGetProfileQueryKey(), result); client.invalidateQueries({ queryKey: getGetProfileQueryKey() }); client.invalidateQueries({ queryKey: getGetPassportQueryKey() }); setSaved(true); window.setTimeout(() => setSaved(false), 3500); } });
  };
  return <PageFrame><div className="page-heading"><div><div className="eyebrow">Private worker profile</div><h1 style={{ marginTop: 10 }}>Your profile.</h1><p className="subtitle">The essentials that travel with your working record. This profile is not public.</p></div><span className="badge badge-finished"><LockKeyhole size={14} /> Private by default</span></div>{saved && <div className="success-box" role="status" data-testid="status-profile-saved"><CheckCircle2 size={22} /> Profile saved.</div>}<div className="profile-layout"><aside className="profile-aside"><div className="avatar" data-testid="avatar-profile">{initials(worker.displayName)}</div><div className="photo-placeholder"><Camera size={18} aria-hidden="true" /><span>{worker.profilePhotoName || 'Profile photo placeholder'}</span></div><h3>{worker.displayName}</h3><p>{worker.primaryRole}</p><p>{worker.homeCityState || 'Home base not set'}</p><div style={{ marginTop: 30, borderTop: '1px solid rgba(255,255,255,.16)', paddingTop: 15, color: 'hsl(43 20% 75%)', fontSize: '.88rem' }}><LockKeyhole size={15} style={{ verticalAlign: '-3px', marginRight: 5 }} />Only you can see this profile</div></aside><form className="card card-pad form-card" onSubmit={submit}><div className="form-grid"><Field label="Display name" name="displayName" required defaultValue={worker.displayName} /><Field label="Home city / state" name="homeCityState" defaultValue={worker.homeCityState} /><Field label="Phone" name="phone" type="tel" defaultValue={worker.phone} /><Field label="Email" name="email" type="email" defaultValue={worker.email} /><Field label="Primary role" name="primaryRole" required defaultValue={worker.primaryRole} /><Field label="Years experience" name="yearsExperience" type="number" min="0" step="1" defaultValue={worker.yearsExperience} /><div className="field full"><label htmlFor="additionalRoles">Additional roles</label><input id="additionalRoles" name="additionalRoles" defaultValue={worker.additionalRoles.join(', ')} placeholder="Rigger, Carpenter, Fly person" data-testid="input-additionalRoles" /><span className="help-text">Separate roles with commas.</span></div><div className="field full"><label htmlFor="skills">Skills</label><input id="skills" name="skills" defaultValue={worker.skills.join(', ')} placeholder="Separate skills with commas" data-testid="input-skills" /></div><div className="field full"><label htmlFor="certifications">Certifications</label><input id="certifications" name="certifications" defaultValue={worker.certifications.join(', ')} placeholder="Separate certifications with commas" data-testid="input-certifications" /></div><div className="field full"><label htmlFor="bio">Short bio</label><textarea id="bio" name="bio" defaultValue={worker.bio || ''} data-testid="input-bio" /></div><div className="field full"><label htmlFor="emergencyContact">Emergency contact</label><input id="emergencyContact" name="emergencyContact" defaultValue={worker.emergencyContact || ''} data-testid="input-emergencyContact" /></div></div>{updateProfile.error && <div className="error-box" role="alert" style={{ marginTop: 20 }}><AlertCircle size={20} /> {(updateProfile.error as Error).message || 'Profile could not be saved.'}</div>}<div className="form-actions"><button className="btn btn-primary" type="submit" disabled={updateProfile.isPending} data-testid="button-save-profile">{updateProfile.isPending ? 'Saving profile…' : <><Save size={18} /> Save profile</>}</button></div></form></div></PageFrame>;
}

function PassportPage() {
  const passport = useGetPassport();
  if (passport.isLoading) return <PageFrame><LoadingState rows={2} /></PageFrame>;
  if (passport.isError || !passport.data) return <PageFrame><ErrorState message={(passport.error as Error)?.message} onRetry={() => passport.refetch()} /></PageFrame>;
  const data = passport.data;
  return <PageFrame><div className="page-heading"><div><div className="eyebrow">Private career record</div><h1 style={{ marginTop: 10 }}>Career Passport</h1><p className="subtitle">A portable summary of your experience, held by you and no one else.</p></div><div className="badge badge-finished"><LockKeyhole size={14} /> Private by default</div></div><section className="passport-hero" data-testid="passport-header"><div><div className="eyebrow">StageWire / verified working history</div><h2>{data.workerName}</h2><p style={{ marginTop: 13, fontSize: '1.12rem' }}>{data.primaryRole}{data.additionalRoles.length > 0 ? ` · ${data.additionalRoles.join(' · ')}` : ''}</p></div><div className="passport-seal"><ShieldCheck size={21} /><span>WORKER<br />OWNED<br />RECORD</span></div></section><div className="passport-grid"><div className="card passport-stat"><strong data-testid="passport-call-count">{data.completedCallCount}</strong><span><b>completed calls</b><br /><span className="help-text">A record built one call at a time.</span></span></div><div className="card passport-stat"><strong>{data.experience.reduce((total, item) => total + item.hours, 0)}h</strong><span><b>logged hours</b><br /><span className="help-text">Across your working roles.</span></span></div><div className="card card-pad"><div className="eyebrow">Role experience</div><div className="experience-list">{data.experience.length > 0 ? data.experience.map((role) => <div className="experience-row" key={role.role}><span><b>{role.role}</b><small>{role.calls} calls</small></span><strong>{role.hours}h</strong></div>) : <p className="help-text" style={{ marginTop: 18 }}>Finish your first call to start the record.</p>}</div></div><div className="card card-pad"><div className="eyebrow">Skills & credentials</div><div className="tag-list">{[...data.skills, ...data.certifications].length > 0 ? [...data.skills, ...data.certifications].map((item, index) => <span className="tag" key={`${item}-${index}`}>{item}</span>) : <p className="help-text" style={{ marginTop: 18 }}>Add skills and certifications in your profile.</p>}</div></div></div></PageFrame>;
}

function PageFrame({ children }: { children: ReactNode }) {
  return <div className="page-wrap">{children}</div>;
}

function Router() {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}><AppShell><Switch><Route path="/" component={DashboardPage} /><Route path="/calls" component={CallsPage} /><Route path="/finish" component={FinishPage} /><Route path="/receipt/:id" component={ReceiptPage} /><Route path="/vault" component={VaultPage} /><Route path="/profile" component={ProfilePage} /><Route path="/passport" component={PassportPage} /><Route component={NotFound} /></Switch></AppShell></ErrorBoundary>;
}

function App() {
  return <QueryClientProvider client={queryClient}><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter><Toaster /></QueryClientProvider>;
}

export default App;