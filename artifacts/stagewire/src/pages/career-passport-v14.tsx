import { BadgeCheck, BriefcaseBusiness, Clock3, LockKeyhole, Printer, ShieldCheck, Wrench } from 'lucide-react';
import { Link } from 'wouter';
import { useGetPassport } from '@workspace/api-client-react';

export default function CareerPassportV14Page() {
  const passport = useGetPassport();
  const data = passport.data;

  if (passport.isLoading) return <div className="page-wrap"><div className="card card-pad"><h2>Building Career Passport…</h2></div></div>;
  if (passport.isError || !data) return <div className="page-wrap"><div className="error-box"><strong>Career Passport could not be opened.</strong><button className="btn btn-quiet" onClick={() => passport.refetch()}>Try again</button></div></div>;

  const totalHours = data.experience.reduce((sum, item) => sum + item.hours, 0);

  return (
    <div className="page-wrap">
      <div className="page-heading print-hide">
        <div><Link href="/vault" className="link-text">The Vault</Link><div className="eyebrow" style={{ marginTop: 22 }}>Worker-controlled proof package</div><h1 style={{ marginTop: 10 }}>Career Passport</h1><p className="subtitle">A clean career snapshot built from work you actually recorded in StageWire.</p></div>
        <button className="btn btn-primary" onClick={() => window.print()}><Printer size={19} /> Print / save PDF</button>
      </div>

      <article className="card card-pad receipt-paper">
        <header className="receipt-head">
          <div><div className="eyebrow">StageWire / Career Passport</div><h2 style={{ marginTop: 8 }}>{data.workerName}</h2><p className="subtitle" style={{ marginTop: 6 }}>{data.primaryRole}</p>{data.additionalRoles.length > 0 && <p className="call-meta" style={{ marginTop: 8 }}>{data.additionalRoles.join(' · ')}</p>}</div>
          <span className="badge badge-active"><LockKeyhole size={15} /> {data.privateByDefault ? 'Private by default' : 'Share-ready'}</span>
        </header>

        <div className="stats-grid" style={{ marginTop: 26 }}>
          <div className="card stat-card"><span className="stat-label">Verified calls</span><strong className="stat-value">{data.completedCallCount}</strong></div>
          <div className="card stat-card"><span className="stat-label">Recorded hours</span><strong className="stat-value">{totalHours.toFixed(1)}h</strong></div>
          <div className="card stat-card"><span className="stat-label">Roles worked</span><strong className="stat-value">{data.experience.length}</strong></div>
          <div className="card stat-card"><span className="stat-label">Certifications</span><strong className="stat-value">{data.certifications.length}</strong></div>
        </div>

        <section style={{ marginTop: 28 }}><div className="eyebrow">Recorded experience</div><h2 style={{ marginTop: 8 }}>Work by role</h2>{data.experience.length ? <div className="experience-list" style={{ marginTop: 16 }}>{data.experience.map((item) => <div className="experience-row" key={item.role}><span><b>{item.role}</b><small>{item.calls} completed {item.calls === 1 ? 'call' : 'calls'}</small></span><span><Clock3 size={17} style={{ verticalAlign: '-3px' }} /> {item.hours.toFixed(1)}h</span></div>)}</div> : <p className="subtitle">Finished calls will build your experience record here.</p>}</section>

        <div className="passport-grid" style={{ marginTop: 28 }}>
          <section className="card card-pad"><div className="eyebrow">Skills</div><h2 style={{ marginTop: 8 }}><Wrench size={20} style={{ verticalAlign: '-3px' }} /> Capabilities</h2>{data.skills.length ? <div className="chip-row" style={{ marginTop: 16 }}>{data.skills.map((item) => <span className="chip" key={item}>{item}</span>)}</div> : <p className="subtitle">No skills saved yet.</p>}</section>
          <section className="card card-pad"><div className="eyebrow">Credentials</div><h2 style={{ marginTop: 8 }}><ShieldCheck size={20} style={{ verticalAlign: '-3px' }} /> Certifications</h2>{data.certifications.length ? <div className="chip-row" style={{ marginTop: 16 }}>{data.certifications.map((item) => <span className="chip" key={item}><BadgeCheck size={15} /> {item}</span>)}</div> : <p className="subtitle">No certifications saved yet.</p>}</section>
        </div>

        <section className="card" style={{ padding: 20, marginTop: 28 }}><div className="eyebrow">Proof, not self-promotion</div><h2 style={{ marginTop: 8 }}><BriefcaseBusiness size={21} style={{ verticalAlign: '-3px' }} /> Built from finished calls</h2><p className="subtitle" style={{ marginTop: 10 }}>StageWire calculates this passport from the worker's completed call records. The worker controls when and how it is shared.</p></section>

        <footer className="receipt-foot" style={{ marginTop: 30 }}><span><LockKeyhole size={15} style={{ verticalAlign: '-3px' }} /> Worker controlled</span><span><BadgeCheck size={15} style={{ verticalAlign: '-3px' }} /> {data.completedCallCount} recorded calls</span><span>StageWire Career Passport</span></footer>
      </article>
    </div>
  );
}
