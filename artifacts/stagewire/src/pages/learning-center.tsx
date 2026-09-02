import { useMemo, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, BookOpenCheck, CalendarClock, GraduationCap, Plus, Search, ShieldCheck, Trash2, Upload, Wrench } from 'lucide-react';
import {
  createCredential,
  getListCredentialsQueryKey,
  useCreateCredential,
  useDeleteCredential,
  useListCredentials,
  useUpdateCredential,
  type Credential,
  type CredentialInputStatus,
} from '@workspace/api-client-react';

type EffectiveStatus = 'current' | 'expiring' | 'expired' | 'planned';
type LegacyCert = { id: number; name: string; issuer?: string; expires?: string; status?: EffectiveStatus };
type TrainingOption = { name: string; why: string; search: string };

const ROLE_TRAINING: Record<string, TrainingOption[]> = {
  Stagehand: [
    { name: 'OSHA 10 — General Industry', why: 'Core hazard awareness for load-ins, load-outs and venue work.', search: 'OSHA 10 general industry authorized training' },
    { name: 'CPR / AED / First Aid', why: 'Useful emergency preparation for long calls and remote festival sites.', search: 'CPR AED first aid certification class' },
    { name: 'MEWP / Aerial Lift Operator', why: 'Useful when a call includes personnel lifts; employer authorization is still required.', search: 'MEWP aerial lift operator training' },
  ],
  'Up Rigger': [
    { name: 'Entertainment Rigging Training', why: 'Builds arena or theatre rigging knowledge before pursuing advanced credentials.', search: 'entertainment rigging training arena theatre' },
    { name: 'Fall Protection / Rescue', why: 'Role-specific preparation for work at height and site rescue plans.', search: 'fall protection rescue training competent person' },
    { name: 'ETCP Rigger Preparation', why: 'A roadmap toward recognized arena or theatre rigging certification.', search: 'ETCP rigger exam preparation training' },
  ],
  'Down Rigger': [
    { name: 'Entertainment Rigging Fundamentals', why: 'Covers hardware, systems, communication and ground-rigging fundamentals.', search: 'entertainment ground rigging fundamentals training' },
    { name: 'Hoist and Motor Safety', why: 'Useful for inspecting, handling and operating entertainment chain hoists.', search: 'entertainment chain hoist motor safety training' },
    { name: 'ETCP Rigger Preparation', why: 'A roadmap toward recognized arena or theatre rigging certification.', search: 'ETCP rigger exam preparation training' },
  ],
  Pusher: [
    { name: 'OSHA 30 — General Industry', why: 'Deeper safety awareness for workers coordinating crews and changing conditions.', search: 'OSHA 30 general industry authorized training' },
    { name: 'Crew Leadership and Communication', why: 'Strengthens briefings, delegation, radio communication and conflict handling.', search: 'live event crew leadership communication training' },
    { name: 'Forklift / MEWP Operator', why: 'Useful when the pusher role overlaps equipment movement; site evaluation is still required.', search: 'forklift MEWP operator training' },
  ],
  Audio: [
    { name: 'Dante Certification', why: 'Builds practical networked-audio skills used across live production.', search: 'Audinate Dante certification training' },
    { name: 'AVIXA CTS Preparation', why: 'Broad audiovisual systems knowledge and a path toward the CTS credential.', search: 'AVIXA CTS prep course' },
    { name: 'Live Sound Fundamentals', why: 'Signal flow, gain structure, patching, microphones and troubleshooting.', search: 'live sound fundamentals hands-on training' },
  ],
  Lighting: [
    { name: 'Entertainment Electrics', why: 'Covers power, data, patching, fixtures and safe backstage electrical practice.', search: 'entertainment electrics stage lighting training' },
    { name: 'Lighting Console Training', why: 'Builds programming skills for the console family used in your market.', search: 'ETC grandMA lighting console training' },
    { name: 'Electrical Safety', why: 'Hazard awareness for temporary power and energized equipment.', search: 'electrical safety training live events' },
  ],
  Video: [
    { name: 'AVIXA CTS Preparation', why: 'Broad audiovisual systems knowledge with a recognized credential path.', search: 'AVIXA CTS prep course' },
    { name: 'LED Video Wall Training', why: 'Covers processing, cabling, build workflow and troubleshooting.', search: 'LED video wall technician training' },
    { name: 'Video Signal and Networking', why: 'Builds routing, conversion, transport and network troubleshooting skills.', search: 'live event video signal networking training' },
  ],
  Carpentry: [
    { name: 'Entertainment Scenic Carpentry', why: 'Role-specific fabrication, installation and backstage workflow.', search: 'entertainment scenic carpentry training' },
    { name: 'Power Tool Safety', why: 'Practical preparation for portable and shop tools used on calls.', search: 'power tool safety training class' },
    { name: 'Scaffold User Training', why: 'Useful when scenic work involves supported scaffolds; site rules still control.', search: 'scaffold user training class' },
  ],
  'Forklift / Aerial Lift Operator': [
    { name: 'Forklift Operator Training', why: 'Formal instruction plus the employer workplace evaluation required for operation.', search: 'forklift operator certification training' },
    { name: 'MEWP Operator Training', why: 'Preparation for boom and scissor lifts used in venues and festivals.', search: 'MEWP boom scissor lift operator training' },
    { name: 'Equipment Spotter / Signalperson', why: 'Safer communication around moving equipment and congested loading areas.', search: 'equipment spotter signalperson training' },
  ],
  'Show Crew / Deck': [
    { name: 'Stagecraft Fundamentals', why: 'Practical deck operations, terminology, scene changes and backstage communication.', search: 'stagecraft fundamentals continuing education' },
    { name: 'OSHA 10 — General Industry', why: 'Core hazard awareness for changing show and venue conditions.', search: 'OSHA 10 general industry authorized training' },
    { name: 'CPR / AED / First Aid', why: 'Useful emergency preparation for performance and event crews.', search: 'CPR AED first aid certification class' },
  ],
};

const LEGACY_KEY = 'stagewire-learning-certs-v14';

function dateOnly(value: string | null | undefined) {
  return value ? value.slice(0, 10) : '';
}

function daysUntil(date: string) {
  if (!date) return null;
  const target = new Date(`${date}T12:00:00`).getTime();
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return Math.ceil((target - today.getTime()) / 86400000);
}

function effectiveStatus(cert: Pick<Credential, 'status' | 'expires'>): EffectiveStatus {
  if (cert.status === 'planned') return 'planned';
  const days = daysUntil(dateOnly(cert.expires));
  if (days !== null && days < 0) return 'expired';
  if (days !== null && days <= 60) return 'expiring';
  return 'current';
}

function readLegacyStored(): LegacyCert[] {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return [];
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function credentialSignature(cert: { name: string; issuer?: string; expires?: string | null; status?: string }) {
  const storedStatus = cert.status === 'planned' ? 'planned' : 'current';
  return [cert.name.trim().toLowerCase(), (cert.issuer || '').trim().toLowerCase(), dateOnly(cert.expires), storedStatus].join('|');
}

export default function LearningCenterPage() {
  const queryClient = useQueryClient();
  const credentials = useListCredentials();
  const create = useCreateCredential();
  const update = useUpdateCredential();
  const remove = useDeleteCredential();
  const [showAdd, setShowAdd] = useState(false);
  const [legacy] = useState(readLegacyStored);
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState('');
  const [learningRole, setLearningRole] = useState('Stagehand');
  const [trainingLocation, setTrainingLocation] = useState('');
  const [planMessage, setPlanMessage] = useState('');

  const rows = credentials.data || [];
  const roleTraining = ROLE_TRAINING[learningRole] || [];
  const trainingSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(`${learningRole} live event training certification ${trainingLocation.trim() || 'near me'}`)}`;
  const normalized = useMemo(() => rows.map((cert) => ({ ...cert, effectiveStatus: effectiveStatus(cert) })), [rows]);
  const serverSignatures = useMemo(() => new Set(rows.map(credentialSignature)), [rows]);
  const legacyToImport = useMemo(() => legacy.filter((cert) => cert.name?.trim() && !serverSignatures.has(credentialSignature(cert))), [legacy, serverSignatures]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: getListCredentialsQueryKey() });

  const add = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') || '').trim();
    if (!name) return;
    const status = String(form.get('status') || 'current') as CredentialInputStatus;
    create.mutate({ data: {
      name,
      issuer: String(form.get('issuer') || '').trim(),
      expires: String(form.get('expires') || '') || null,
      status,
    } }, {
      onSuccess: () => {
        refresh();
        setShowAdd(false);
        event.currentTarget.reset();
      },
    });
  };

  const changeStatus = (credentialId: number, status: CredentialInputStatus) => {
    update.mutate({ credentialId, data: { status } }, { onSuccess: refresh });
  };

  const deleteCredentialRow = (credentialId: number) => {
    remove.mutate({ credentialId }, { onSuccess: refresh });
  };

  const addTrainingPlan = (option: TrainingOption) => {
    setPlanMessage('');
    create.mutate({ data: { name: option.name, issuer: '', expires: null, status: 'planned' } }, {
      onSuccess: () => {
        refresh();
        setPlanMessage(`${option.name} added to your planned credentials.`);
      },
    });
  };

  const importLegacy = async () => {
    if (legacyToImport.length === 0) return;
    setImporting(true);
    setImportMessage('');
    try {
      for (const cert of legacyToImport) {
        await createCredential({
          name: cert.name.trim(),
          issuer: (cert.issuer || '').trim(),
          expires: dateOnly(cert.expires) || null,
          status: cert.status === 'planned' ? 'planned' : 'current',
        });
      }
      localStorage.removeItem(LEGACY_KEY);
      await refresh();
      setImportMessage(`${legacyToImport.length} browser credential${legacyToImport.length === 1 ? '' : 's'} moved into your worker record.`);
    } catch {
      await refresh();
      setImportMessage('Some browser credentials could not be imported. Nothing was deleted from the old browser copy; try again after the connection is stable.');
    } finally {
      setImporting(false);
    }
  };

  if (credentials.isLoading) return <div className="page-wrap"><div className="card card-pad"><h2>Opening Learning…</h2></div></div>;
  if (credentials.isError) return <div className="page-wrap"><div className="error-box"><strong>Learning could not load your credential wallet.</strong><button className="btn btn-quiet" onClick={() => credentials.refetch()}>Try again</button></div></div>;

  const mutationError = create.error || update.error || remove.error;

  return <div className="page-wrap"><div className="page-heading"><div><div className="eyebrow">Skills / education / certifications</div><h1 style={{ marginTop: 10 }}>Learning</h1><p className="subtitle">Know what you have, what is coming due, and what you want to learn next. Credential records now follow the worker record instead of living only in one browser.</p></div><button className="btn btn-primary" onClick={() => setShowAdd(true)}><Plus size={19}/> Add certification</button></div>

  {legacyToImport.length > 0 && <section className="card card-pad" style={{ marginBottom: 22 }}><div className="finish-context"><div><div className="eyebrow">Old browser records found</div><h2 style={{ marginTop: 7 }}>Bring your earlier credentials forward.</h2><p className="subtitle">StageWire found {legacyToImport.length} credential{legacyToImport.length === 1 ? '' : 's'} saved by the older browser-only Learning wallet. Importing copies only missing records and leaves the old copy alone until the import finishes.</p></div><button className="btn btn-secondary" type="button" disabled={importing} onClick={importLegacy}><Upload size={18}/>{importing ? ' Importing…' : ' Import browser credentials'}</button></div></section>}
  {importMessage && <div className={importMessage.startsWith('Some') ? 'error-box' : 'success-box'} role="status">{importMessage}</div>}

  <div className="stats-grid"><div className="card stat-card"><span className="stat-label">Tracked</span><strong className="stat-value">{normalized.length}</strong></div><div className="card stat-card"><span className="stat-label">Current</span><strong className="stat-value">{normalized.filter(c=>c.effectiveStatus==='current').length}</strong></div><div className="card stat-card"><span className="stat-label">Expiring ≤60 days</span><strong className="stat-value">{normalized.filter(c=>c.effectiveStatus==='expiring').length}</strong></div><div className="card stat-card"><span className="stat-label">Expired</span><strong className="stat-value">{normalized.filter(c=>c.effectiveStatus==='expired').length}</strong></div><div className="card stat-card"><span className="stat-label">Planned</span><strong className="stat-value">{normalized.filter(c=>c.effectiveStatus==='planned').length}</strong></div></div>

  <section className="card card-pad" style={{marginTop:22}}><div className="eyebrow">Credential wallet</div><h2 style={{marginTop:7}}><BadgeCheck size={22}/> Your certifications</h2><p className="help-text">Mark something planned until you actually earn it. StageWire derives expiring and expired from the saved date—you cannot accidentally mark an expired card current.</p>{normalized.length === 0 ? <div className="empty" style={{ marginTop: 16 }}><h3>No credentials saved yet.</h3><p>Add one you actually hold, or add a planned credential as part of your roadmap.</p></div> : <div className="experience-list" style={{marginTop:16}}>{normalized.map(cert=>{const expires=dateOnly(cert.expires);const days=daysUntil(expires); return <div className="experience-row" key={cert.id}><span><b>{cert.name}</b><small>{cert.issuer || 'Issuer not added'}{expires ? ` · expires ${expires}` : ' · no expiration saved'}{days!==null && days<0 ? ` · expired ${Math.abs(days)} days ago` : days!==null && days<=60 ? ` · ${days} days left` : ''}</small></span><span className="form-actions"><select aria-label={`${cert.name} status`} value={cert.status} disabled={update.isPending} onChange={e=>changeStatus(cert.id,e.target.value as CredentialInputStatus)}><option value="current">Earned</option><option value="planned">Planned</option></select><span className={`badge badge-${cert.effectiveStatus==='current'||cert.effectiveStatus==='expiring'?'active':'finished'}`}>{cert.effectiveStatus}</span><button className="icon-btn" aria-label={`Remove ${cert.name}`} disabled={remove.isPending} onClick={()=>deleteCredentialRow(cert.id)}><Trash2 size={17}/></button></span></div>})}</div>}</section>

  {mutationError && <div className="error-box" role="alert" style={{ marginTop: 18 }}><strong>{(mutationError as Error).message || 'Credential change could not be saved.'}</strong></div>}

  <section className="card card-pad" style={{ marginTop: 22 }}>
    <div className="eyebrow">Find education for the job</div>
    <h2 style={{ marginTop: 7 }}><Search size={22}/> Role-based training finder</h2>
    <p className="subtitle">Choose the position you want to strengthen. StageWire will suggest useful next steps, then help you search for current classes near you.</p>
    <div className="form-grid" style={{ marginTop: 18 }}>
      <div className="field"><label htmlFor="learning-role">Position</label><select id="learning-role" value={learningRole} onChange={(event) => { setLearningRole(event.target.value); setPlanMessage(''); }}>{Object.keys(ROLE_TRAINING).map((role) => <option key={role}>{role}</option>)}</select></div>
      <div className="field"><label htmlFor="training-location">City, state or ZIP</label><input id="training-location" value={trainingLocation} onChange={(event) => setTrainingLocation(event.target.value)} placeholder="Knoxville, TN"/></div>
    </div>
    <div className="experience-list" style={{ marginTop: 18 }}>{roleTraining.map((option) => <div className="experience-row" key={option.name}><span><b>{option.name}</b><small>{option.why}</small></span><button className="btn btn-secondary" type="button" disabled={create.isPending} onClick={() => addTrainingPlan(option)}><Plus size={17}/> Add to my plan</button></div>)}</div>
    {planMessage && <div className="success-box" role="status" style={{ marginTop: 16 }}>{planMessage}</div>}
    <div className="form-actions" style={{ marginTop: 18 }}><a className="btn btn-primary" href={trainingSearchUrl} target="_blank" rel="noreferrer"><Search size={18}/> Find current training</a></div>
    <p className="help-text" style={{ marginTop: 14 }}>Course dates, prices, acceptance and requirements change. Verify the provider, employer or union accepts the training before paying. Equipment credentials may still require employer-specific hands-on evaluation.</p>
  </section>

  <div className="passport-grid" style={{marginTop:22}}><section className="card card-pad"><GraduationCap size={25}/><div className="eyebrow" style={{marginTop:12}}>Next skills</div><h2 style={{marginTop:7}}>Build the career, not just the next call.</h2><p className="subtitle">Use planned credentials as a personal roadmap. Earning one is a deliberate status change—StageWire never assumes you passed a course.</p></section><section className="card card-pad"><CalendarClock size={25}/><div className="eyebrow" style={{marginTop:12}}>Expiration awareness</div><h2 style={{marginTop:7}}>No surprise expired cards.</h2><p className="subtitle">Earned credentials show as expiring within 60 days, then expired after the saved expiration date passes. Expired proof stays in your private record but no longer counts as current.</p></section><section className="card card-pad"><Wrench size={25}/><div className="eyebrow" style={{marginTop:12}}>Role-based learning</div><h2 style={{marginTop:7}}>Learn what the job actually uses.</h2><p className="subtitle">Training should map to stagehand, rigger, pusher, audio, lighting, video, carpentry and other real backstage roles—not one giant generic list.</p></section><section className="card card-pad"><ShieldCheck size={25}/><div className="eyebrow" style={{marginTop:12}}>Worker controlled</div><h2 style={{marginTop:7}}>Share proof, not your whole life.</h2><p className="subtitle">Only current or expiring credentials can feed Career Passport when certification sharing is enabled. Expired and planned credentials stay private.</p></section></div>

  {showAdd&&<div className="modal-surface" role="dialog" aria-modal="true" aria-label="Add certification"><div className="modal-dialog card"><div className="card-pad"><div className="eyebrow">Credential</div><h2 style={{marginTop:7}}>Add certification</h2><form onSubmit={add}><div className="form-grid" style={{marginTop:18}}><div className="field"><label htmlFor="credential-name">Name *</label><input id="credential-name" name="name" required placeholder="OSHA 30, Dante Level 1…"/></div><div className="field"><label htmlFor="credential-issuer">Issuer</label><input id="credential-issuer" name="issuer" placeholder="Training provider"/></div><div className="field"><label htmlFor="credential-expires">Expiration date</label><input id="credential-expires" name="expires" type="date"/></div><div className="field"><label htmlFor="credential-status">Status</label><select id="credential-status" name="status" defaultValue="current"><option value="current">I earned this</option><option value="planned">I plan to earn this</option></select></div></div><div className="form-actions"><button className="btn btn-primary" type="submit" disabled={create.isPending}><BookOpenCheck size={18}/>{create.isPending ? ' Saving…' : ' Save'}</button><button className="btn btn-quiet" type="button" onClick={()=>setShowAdd(false)}>Not now</button></div></form></div></div></div>}</div>;
}
