import { Archive, BadgeCheck, Camera, FileText, LockKeyhole, ReceiptText, Settings2, ShieldCheck, UserRound } from 'lucide-react';
import { Link } from 'wouter';
import { useGetProfile, useGetVault } from '@workspace/api-client-react';

type LocalFile = { name: string; size: number; type: string };
const FILES_KEY = 'stagewire-profile-files-v14';
function profileFiles(): { certifications: LocalFile[]; documents: LocalFile[] } {
  try { return { certifications: [], documents: [], ...JSON.parse(localStorage.getItem(FILES_KEY) || '{}') }; }
  catch { return { certifications: [], documents: [] }; }
}

function money(value: number) { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value || 0); }
function workDate(value: string) { const date = new Date(`${value}T12:00:00`); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date); }

export default function WorkerVaultPage() {
  const vault = useGetVault();
  const profile = useGetProfile();
  const data = vault.data;
  const worker = profile.data;
  const localFiles = profileFiles();

  if (vault.isLoading || profile.isLoading) return <div className="page-wrap"><div className="card card-pad"><h2>Opening The Vault…</h2></div></div>;
  if (vault.isError || !data) return <div className="page-wrap"><div className="error-box"><strong>The Vault could not be opened.</strong><button className="btn btn-quiet" onClick={() => vault.refetch()}>Try again</button></div></div>;

  const totalHours = data.calls.reduce((sum, call) => sum + call.hours, 0);
  const totalGross = data.calls.reduce((sum, call) => sum + call.gross, 0);
  const allDocuments = [...localFiles.documents, ...data.documents.map((item) => ({ name: item.name, size: 0, type: 'call document' }))];

  return (
    <div className="page-wrap">
      <div className="page-heading">
        <div><div className="eyebrow">Worker-owned records</div><h1 style={{ marginTop: 10 }}>The Vault</h1><p className="subtitle">Finished calls, proof of work, certifications, skills, documents, and photos. Private until you choose to share.</p></div>
        <div className="form-actions"><Link href="/worker-setup" className="btn btn-secondary"><Settings2 size={19} /> Worker setup</Link><Link href="/passport-v14" className="btn btn-primary"><BadgeCheck size={19} /> Career Passport</Link></div>
      </div>

      <section className="card card-pad vault-owner-card">
        <div className="vault-owner-icon"><UserRound size={28} /></div><div><div className="eyebrow">Private owner</div><h2 style={{ marginTop: 5 }}>{worker?.displayName || 'Worker profile'}</h2><p className="subtitle">Profile contact information and uploaded source files stay here. Career Passport only uses fields you approve.</p></div><span className="badge badge-finished"><LockKeyhole size={15} /> Not public</span>
      </section>

      <div className="card card-pad" style={{ marginBottom: 22 }}>
        <div className="finish-context"><div><div className="eyebrow">Your permanent work record</div><h2 style={{ marginTop: 7 }}>{data.calls.length} finished {data.calls.length === 1 ? 'call' : 'calls'}</h2></div><span className="badge badge-active"><LockKeyhole size={15} /> Private by default</span></div>
        <div className="stats-grid" style={{ marginTop: 18 }}>
          <div className="card stat-card"><span className="stat-label">Recorded hours</span><strong className="stat-value">{totalHours.toFixed(1)}h</strong></div>
          <div className="card stat-card"><span className="stat-label">Recorded gross</span><strong className="stat-value">{money(totalGross)}</strong></div>
          <div className="card stat-card"><span className="stat-label">Private files</span><strong className="stat-value">{localFiles.certifications.length + allDocuments.length}</strong></div>
          <div className="card stat-card"><span className="stat-label">Work photos</span><strong className="stat-value">{data.photos.length}</strong></div>
        </div>
      </div>

      <section style={{ marginBottom: 28 }}>
        <div className="section-label"><h2>Call receipts</h2><span className="help-text">Tap a call to open its proof-of-work record.</span></div>
        {data.calls.length === 0 ? <div className="card empty"><div className="empty-mark"><Archive size={25} /></div><h3>No finished calls yet.</h3><p style={{ marginTop: 8 }}>Finish your first call and StageWire will lock its receipt here.</p></div> : <div className="calls-list">{data.calls.map((call) => <Link href={`/receipt/${call.id}`} className="card call-card" key={call.id}><div className="call-date"><strong>{new Date(`${call.workDate}T12:00:00`).getDate()}</strong><span>{new Date(`${call.workDate}T12:00:00`).toLocaleString('en-US', { month: 'short' })}</span></div><div className="call-main"><div className="call-topline"><span className="badge badge-finished">Finished</span><span>{workDate(call.workDate)}</span></div><h3>{call.showName}</h3><p>{call.venue} · {call.role}</p></div><div className="call-money"><strong>{money(call.gross)}</strong><span>{call.hours.toFixed(1)}h</span><span className="link-text"><ReceiptText size={16} /> Receipt</span></div></Link>)}</div>}
      </section>

      <div className="passport-grid">
        <section className="card card-pad"><div className="eyebrow">Certifications</div><h2 style={{ marginTop: 8 }}>Credentials</h2>{data.certifications.length ? <div className="chip-row" style={{ marginTop: 18 }}>{data.certifications.map((item) => <span className="chip" key={item}><ShieldCheck size={15} /> {item}</span>)}</div> : <p className="subtitle">No certification names saved yet.</p>}{localFiles.certifications.length > 0 && <div className="vault-items" style={{ marginTop: 16 }}>{localFiles.certifications.map((item, index) => <div className="vault-item" key={`${item.name}-${index}`}><span><FileText size={17} /> {item.name}</span><span>private source file</span></div>)}</div>}</section>
        <section className="card card-pad"><div className="eyebrow">Skills</div><h2 style={{ marginTop: 8 }}>What you can do</h2>{data.skills.length ? <div className="chip-row" style={{ marginTop: 18 }}>{data.skills.map((item) => <span className="chip" key={item}>{item}</span>)}</div> : <p className="subtitle">No skills saved yet.</p>}</section>
        <section className="card card-pad"><div className="eyebrow">Documents</div><h2 style={{ marginTop: 8 }}>Private files</h2>{allDocuments.length ? <div className="vault-items" style={{ marginTop: 14 }}>{allDocuments.map((item, index) => <div className="vault-item" key={`${item.name}-${index}`}><span><FileText size={17} /> {item.name}</span><span>{item.type}</span></div>)}</div> : <p className="subtitle">No documents selected yet.</p>}</section>
        <section className="card card-pad"><div className="eyebrow">Work photos</div><h2 style={{ marginTop: 8 }}>Visual record</h2>{data.photos.length ? <div className="vault-items" style={{ marginTop: 14 }}>{data.photos.map((item, index) => <div className="vault-item" key={`${item.callId}-${item.name}-${index}`}><span><Camera size={17} /> {item.name}</span><Link href={`/receipt/${item.callId}`} className="link-text">Call #{item.callId}</Link></div>)}</div> : <p className="subtitle">Work photos will collect here with their calls.</p>}</section>
      </div>
    </div>
  );
}
