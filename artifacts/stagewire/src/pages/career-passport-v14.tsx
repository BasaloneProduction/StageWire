import { BadgeCheck, BriefcaseBusiness, Clock3, Eye, EyeOff, LockKeyhole, Printer, Settings2, ShieldCheck, Wrench } from 'lucide-react';
import { Link } from 'wouter';
import { useGetPassport, useGetProfile } from '@workspace/api-client-react';

type ShareSettings = { sharePhoto: boolean; shareHomeBase: boolean; shareSkills: boolean; shareCertifications: boolean };
const SHARE_KEY = 'stagewire-share-settings-v14';
const PHOTO_KEY = 'stagewire-profile-photo-preview-v14';

function settings(): ShareSettings {
  try { return { sharePhoto: false, shareHomeBase: false, shareSkills: true, shareCertifications: true, ...JSON.parse(localStorage.getItem(SHARE_KEY) || '{}') }; }
  catch { return { sharePhoto: false, shareHomeBase: false, shareSkills: true, shareCertifications: true }; }
}

export default function CareerPassportV14Page() {
  const passport = useGetPassport();
  const profile = useGetProfile();
  const data = passport.data;
  const worker = profile.data;
  const share = settings();
  const photo = localStorage.getItem(PHOTO_KEY) || '';

  if (passport.isLoading || profile.isLoading) return <div className="page-wrap"><div className="card card-pad"><h2>Building Career Passport…</h2></div></div>;
  if (passport.isError || !data) return <div className="page-wrap"><div className="error-box"><strong>Career Passport could not be opened.</strong><button className="btn btn-quiet" onClick={() => passport.refetch()}>Try again</button></div></div>;

  const totalHours = data.experience.reduce((sum, item) => sum + item.hours, 0);
  const visibleCerts = share.shareCertifications ? data.certifications : [];
  const visibleSkills = share.shareSkills ? data.skills : [];

  return (
    <div className="page-wrap">
      <div className="page-heading print-hide">
        <div><Link href="/vault-v14" className="link-text">The Vault</Link><div className="eyebrow" style={{ marginTop: 22 }}>Worker-controlled proof package</div><h1 style={{ marginTop: 10 }}>Career Passport</h1><p className="subtitle">Preview exactly what another person would see. Private information stays out.</p></div>
        <div className="form-actions"><Link href="/worker-setup" className="btn btn-secondary"><Settings2 size={19} /> Sharing controls</Link><button className="btn btn-primary" onClick={() => window.print()}><Printer size={19} /> Print / save PDF</button></div>
      </div>

      <div className="card card-pad passport-privacy-summary print-hide">
        <div><div className="eyebrow">Share preview</div><h2 style={{ marginTop: 7 }}>You control this package.</h2><p className="subtitle">Phone, email, emergency contact, and private uploaded files are never shown here.</p></div>
        <div className="privacy-chip-row"><span className={share.sharePhoto ? 'chip' : 'chip muted-chip'}>{share.sharePhoto ? <Eye size={15} /> : <EyeOff size={15} />} Photo</span><span className={share.shareHomeBase ? 'chip' : 'chip muted-chip'}>{share.shareHomeBase ? <Eye size={15} /> : <EyeOff size={15} />} Home base</span><span className={share.shareSkills ? 'chip' : 'chip muted-chip'}>{share.shareSkills ? <Eye size={15} /> : <EyeOff size={15} />} Skills</span><span className={share.shareCertifications ? 'chip' : 'chip muted-chip'}>{share.shareCertifications ? <Eye size={15} /> : <EyeOff size={15} />} Certifications</span></div>
      </div>

      <article className="card card-pad receipt-paper">
        <header className="receipt-head">
          <div className="passport-identity">{share.sharePhoto && photo && <img className="passport-photo" src={photo} alt="Worker profile" />}<div><div className="eyebrow">StageWire / Career Passport</div><h2 style={{ marginTop: 8 }}>{data.workerName}</h2><p className="subtitle" style={{ marginTop: 6 }}>{data.primaryRole}</p>{data.additionalRoles.length > 0 && <p className="call-meta" style={{ marginTop: 8 }}>{data.additionalRoles.join(' · ')}</p>}{share.shareHomeBase && worker?.homeCityState && <p className="call-meta" style={{ marginTop: 8 }}>{worker.homeCityState}</p>}</div></div>
          <span className="badge badge-active"><LockKeyhole size={15} /> Worker approved</span>
        </header>

        <div className="stats-grid" style={{ marginTop: 26 }}>
          <div className="card stat-card"><span className="stat-label">Recorded calls</span><strong className="stat-value">{data.completedCallCount}</strong></div>
          <div className="card stat-card"><span className="stat-label">Recorded hours</span><strong className="stat-value">{totalHours.toFixed(1)}h</strong></div>
          <div className="card stat-card"><span className="stat-label">Roles worked</span><strong className="stat-value">{data.experience.length}</strong></div>
          <div className="card stat-card"><span className="stat-label">Shared credentials</span><strong className="stat-value">{visibleCerts.length}</strong></div>
        </div>

        <section style={{ marginTop: 28 }}><div className="eyebrow">Recorded experience</div><h2 style={{ marginTop: 8 }}>Work by role</h2>{data.experience.length ? <div className="experience-list" style={{ marginTop: 16 }}>{data.experience.map((item) => <div className="experience-row" key={item.role}><span><b>{item.role}</b><small>{item.calls} completed {item.calls === 1 ? 'call' : 'calls'}</small></span><span><Clock3 size={17} style={{ verticalAlign: '-3px' }} /> {item.hours.toFixed(1)}h</span></div>)}</div> : <p className="subtitle">Finished calls will build your experience record here.</p>}</section>

        <div className="passport-grid" style={{ marginTop: 28 }}>
          {share.shareSkills ? <section className="card card-pad"><div className="eyebrow">Skills</div><h2 style={{ marginTop: 8 }}><Wrench size={20} style={{ verticalAlign: '-3px' }} /> Capabilities</h2>{visibleSkills.length ? <div className="chip-row" style={{ marginTop: 16 }}>{visibleSkills.map((item) => <span className="chip" key={item}>{item}</span>)}</div> : <p className="subtitle">No skills saved yet.</p>}</section> : <HiddenSection label="Skills" />}
          {share.shareCertifications ? <section className="card card-pad"><div className="eyebrow">Credentials</div><h2 style={{ marginTop: 8 }}><ShieldCheck size={20} style={{ verticalAlign: '-3px' }} /> Certifications</h2>{visibleCerts.length ? <div className="chip-row" style={{ marginTop: 16 }}>{visibleCerts.map((item) => <span className="chip" key={item}><BadgeCheck size={15} /> {item}</span>)}</div> : <p className="subtitle">No certifications saved yet.</p>}</section> : <HiddenSection label="Certifications" />}
        </div>

        <section className="card" style={{ padding: 20, marginTop: 28 }}><div className="eyebrow">Worker-owned proof</div><h2 style={{ marginTop: 8 }}><BriefcaseBusiness size={21} style={{ verticalAlign: '-3px' }} /> Built from finished calls</h2><p className="subtitle" style={{ marginTop: 10 }}>StageWire builds this summary from the worker's recorded calls. It is not a public profile and nothing is shared automatically.</p></section>

        <footer className="receipt-foot" style={{ marginTop: 30 }}><span><LockKeyhole size={15} style={{ verticalAlign: '-3px' }} /> Worker controlled</span><span><BadgeCheck size={15} style={{ verticalAlign: '-3px' }} /> {data.completedCallCount} recorded calls</span><span>StageWire Career Passport</span></footer>
      </article>
    </div>
  );
}

function HiddenSection({ label }: { label: string }) {
  return <section className="card card-pad passport-hidden"><EyeOff size={22} /><div><div className="eyebrow">Not shared</div><h2 style={{ marginTop: 6 }}>{label}</h2><p className="subtitle">Hidden by the worker.</p></div></section>;
}
