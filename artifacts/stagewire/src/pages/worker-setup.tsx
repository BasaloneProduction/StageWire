import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { BookOpenCheck, Camera, CheckCircle2, LockKeyhole, Save, ShieldCheck, UserRound } from 'lucide-react';
import { Link } from 'wouter';
import {
  getGetPassportQueryKey,
  getGetProfileQueryKey,
  useGetProfile,
  useUpdateProfile,
  type ProfileInput,
} from '@workspace/api-client-react';
import WorkerFileMetadataPanel from '@/components/worker-file-metadata';
import { AccountSecurityPanel } from '@/pages/account-security';

type ShareSettings = {
  sharePhoto: boolean;
  shareHomeBase: boolean;
  shareSkills: boolean;
  shareCertifications: boolean;
};

const LEGACY_SHARE_KEY = 'stagewire-share-settings-v14';
const PHOTO_KEY = 'stagewire-profile-photo-preview-v14';

function readLegacyShareSettings(): ShareSettings | null {
  try {
    const raw = localStorage.getItem(LEGACY_SHARE_KEY);
    if (raw) return { sharePhoto: false, shareHomeBase: false, shareSkills: true, shareCertifications: true, ...JSON.parse(raw) };
  } catch {}
  return null;
}

export default function WorkerSetupPage() {
  const profile = useGetProfile();
  const updateProfile = useUpdateProfile();
  const client = useQueryClient();
  const [saved, setSaved] = useState(false);
  const [shareDraft, setShareDraft] = useState<ShareSettings | null>(readLegacyShareSettings);
  const [photoName, setPhotoName] = useState('');
  const [photoPreview, setPhotoPreview] = useState(() => localStorage.getItem(PHOTO_KEY) || '');

  const worker = profile.data;
  const completion = useMemo(() => {
    if (!worker) return 0;
    const checks = [worker.displayName, worker.primaryRole, worker.homeCityState, worker.skills.length];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [worker]);

  if (profile.isLoading) return <div className="page-wrap"><div className="card card-pad"><h2>Opening worker setup…</h2></div></div>;
  if (profile.isError || !worker) return <div className="page-wrap"><div className="error-box"><strong>Worker setup could not load.</strong><button className="btn btn-quiet" onClick={() => profile.refetch()}>Try again</button></div></div>;

  const share: ShareSettings = shareDraft ?? {
    sharePhoto: worker.sharePhoto,
    shareHomeBase: worker.shareHomeBase,
    shareSkills: worker.shareSkills,
    shareCertifications: worker.shareCertifications,
  };

  const saveShare = (next: ShareSettings) => {
    setShareDraft(next);
  };

  const pickPhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setPhotoName(file.name);
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      setPhotoPreview(result);
      try { localStorage.setItem(PHOTO_KEY, result); } catch {}
    };
    reader.readAsDataURL(file);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload: ProfileInput = {
      displayName: String(form.get('displayName') || '').trim(),
      homeCityState: String(form.get('homeCityState') || '').trim(),
      phone: String(form.get('phone') || '').trim(),
      email: String(form.get('email') || '').trim(),
      primaryRole: String(form.get('primaryRole') || '').trim(),
      additionalRoles: String(form.get('additionalRoles') || '').split(',').map((item) => item.trim()).filter(Boolean),
      yearsExperience: Number(form.get('yearsExperience') || 0),
      skills: String(form.get('skills') || '').split(',').map((item) => item.trim()).filter(Boolean),
      certifications: worker.certifications,
      bio: String(form.get('bio') || '').trim() || null,
      emergencyContact: String(form.get('emergencyContact') || '').trim() || null,
      profilePhotoName: photoName || worker.profilePhotoName,
      sharePhoto: share.sharePhoto,
      shareHomeBase: share.shareHomeBase,
      shareSkills: share.shareSkills,
      shareCertifications: share.shareCertifications,
    };

    updateProfile.mutate({ data: payload }, {
      onSuccess: (result) => {
        client.setQueryData(getGetProfileQueryKey(), result);
        client.invalidateQueries({ queryKey: getGetProfileQueryKey() });
        client.invalidateQueries({ queryKey: getGetPassportQueryKey() });
        try { localStorage.removeItem(LEGACY_SHARE_KEY); } catch {}
        setShareDraft(null);
        setSaved(true);
        window.setTimeout(() => setSaved(false), 3000);
      },
    });
  };

  return (
    <div className="page-wrap worker-setup-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">Worker setup / optional</div>
          <h1 style={{ marginTop: 10 }}>Set it up once.</h1>
          <p className="subtitle">Start with the basics. Add more only when it helps you. Nothing here blocks you from logging a call.</p>
        </div>
        <span className="badge badge-finished"><LockKeyhole size={14} /> Private by default</span>
      </div>

      {saved && <div className="success-box" role="status"><CheckCircle2 size={22} /> Worker profile saved.</div>}

      <section className="card card-pad setup-progress" aria-label="Profile setup progress">
        <div><div className="eyebrow">Setup progress</div><h2 style={{ marginTop: 7 }}>{completion}% ready</h2><p className="subtitle">You do not need 100% to use StageWire.</p></div>
        <div className="setup-progress-bar" aria-hidden="true"><span style={{ width: `${completion}%` }} /></div>
      </section>

      <form onSubmit={submit}>
        <section className="card card-pad setup-section">
          <div className="setup-section-head"><span className="setup-step">1</span><div><div className="eyebrow">Minimum setup</div><h2>Your working identity</h2><p className="subtitle">Only name and primary role are required.</p></div></div>
          <div className="form-grid">
            <div className="field"><label htmlFor="displayName">Display name *</label><input id="displayName" name="displayName" required defaultValue={worker.displayName} /></div>
            <div className="field"><label htmlFor="primaryRole">Primary role *</label><input id="primaryRole" name="primaryRole" required defaultValue={worker.primaryRole} placeholder="Stagehand, Rigger, Pusher…" /></div>
            <div className="field"><label htmlFor="homeCityState">Home city / state</label><input id="homeCityState" name="homeCityState" defaultValue={worker.homeCityState} /></div>
            <div className="field"><label htmlFor="yearsExperience">Years experience</label><input id="yearsExperience" name="yearsExperience" type="number" min="0" step="1" defaultValue={worker.yearsExperience} /></div>
            <div className="field full"><label htmlFor="additionalRoles">Additional roles</label><input id="additionalRoles" name="additionalRoles" defaultValue={worker.additionalRoles.join(', ')} placeholder="Down Rigger, Pusher, Video" /><span className="help-text">Comma-separated. Add only roles you actually work.</span></div>
          </div>
        </section>

        <section className="card card-pad setup-section">
          <div className="setup-section-head"><span className="setup-step">2</span><div><div className="eyebrow">Private contact</div><h2>For you, not the Passport</h2><p className="subtitle">Phone, email, and emergency contact stay private unless a future share screen explicitly asks you.</p></div></div>
          <div className="form-grid">
            <div className="field"><label htmlFor="phone">Phone</label><input id="phone" name="phone" type="tel" defaultValue={worker.phone} /></div>
            <div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" defaultValue={worker.email} /></div>
            <div className="field full"><label htmlFor="emergencyContact">Emergency contact</label><input id="emergencyContact" name="emergencyContact" defaultValue={worker.emergencyContact || ''} placeholder="Name and phone number" /></div>
          </div>
        </section>

        <section className="card card-pad setup-section">
          <div className="setup-section-head"><span className="setup-step">3</span><div><div className="eyebrow">Professional record</div><h2>Skills & Learning</h2><p className="subtitle">Skills live here. Certifications have one home in Learning so you do not have to enter the same credential twice.</p></div></div>
          <div className="form-grid">
            <div className="field full"><label htmlFor="skills">Skills</label><input id="skills" name="skills" defaultValue={worker.skills.join(', ')} placeholder="Rigging, cable, video wall, forklift" /></div>
            <div className="field full"><div className="card card-pad"><div className="eyebrow">Certifications</div><h3 style={{ marginTop: 7 }}>Manage credentials in Learning</h3><p className="help-text">Learning tracks earned, expiring, expired, and planned credentials. Career Passport reads approved current credentials from there automatically.</p>{worker.certifications.length > 0 && <p className="help-text" style={{ marginTop: 10 }}>{worker.certifications.length} legacy profile credential{worker.certifications.length === 1 ? '' : 's'} will be preserved while the Learning wallet becomes the source of truth.</p>}<div className="form-actions" style={{ marginTop: 14 }}><Link href="/learning" className="btn btn-secondary"><BookOpenCheck size={18} /> Open Learning</Link></div></div></div>
            <div className="field full"><label htmlFor="bio">Short professional bio</label><textarea id="bio" name="bio" defaultValue={worker.bio || ''} placeholder="A few useful lines. No résumé essay required." /></div>
          </div>
        </section>

        <section className="card card-pad setup-section">
          <div className="setup-section-head"><span className="setup-step">4</span><div><div className="eyebrow">File records</div><h2>Remember the file list across devices.</h2><p className="subtitle">Certification/document filename records now follow your worker account. The underlying file contents are still not uploaded; secure object storage remains a production requirement.</p></div></div>
          <div className="privacy-rule" style={{ marginBottom: 18 }}><ShieldCheck size={20} /><strong>Keep the actual certification or document somewhere safe until StageWire secure storage is wired.</strong></div>
          <div className="upload-grid">
            <div className="upload-card">
              <div className="upload-preview">{photoPreview ? <img src={photoPreview} alt="Profile preview" /> : <UserRound size={44} />}</div>
              <div><h3>Profile photo</h3><p className="help-text">Optional. The photo preview itself still stays local to this browser. StageWire will not claim it followed your account until secure image storage exists.</p><label className="btn btn-secondary file-button"><Camera size={18} /> Choose photo<input type="file" accept="image/*" onChange={pickPhoto} /></label>{(photoName || worker.profilePhotoName) && <div className="file-name">{photoName || worker.profilePhotoName}</div>}</div>
            </div>
            <WorkerFileMetadataPanel />
          </div>
        </section>

        <section className="card card-pad setup-section">
          <div className="setup-section-head"><span className="setup-step">5</span><div><div className="eyebrow">Sharing controls</div><h2>You choose what leaves the Vault.</h2><p className="subtitle">Save Worker Setup to keep these Career Passport choices with your worker record across signed-in devices. Private contact information is never included.</p></div></div>
          <div className="privacy-list">
            <PrivacyToggle label="Profile photo" detail="Off by default" checked={share.sharePhoto} onChange={(value) => saveShare({ ...share, sharePhoto: value })} />
            <PrivacyToggle label="Home base" detail="City/state only" checked={share.shareHomeBase} onChange={(value) => saveShare({ ...share, shareHomeBase: value })} />
            <PrivacyToggle label="Skills" detail="Professional capabilities" checked={share.shareSkills} onChange={(value) => saveShare({ ...share, shareSkills: value })} />
            <PrivacyToggle label="Certifications" detail="Credential names, not private files" checked={share.shareCertifications} onChange={(value) => saveShare({ ...share, shareCertifications: value })} />
          </div>
          <div className="privacy-rule"><ShieldCheck size={20} /><strong>Phone, email, emergency contact, and file contents remain private.</strong></div>
        </section>

        {updateProfile.error && <div className="error-box" role="alert"><strong>{(updateProfile.error as Error).message || 'Profile could not be saved.'}</strong></div>}

        <div className="sticky-save-bar">
          <div><strong>No setup maze.</strong><span>Save what you have and get back to work.</span></div>
          <button className="btn btn-primary" type="submit" disabled={updateProfile.isPending}>{updateProfile.isPending ? 'Saving…' : <><Save size={18} /> Save worker setup</>}</button>
          <Link href="/passport" className="btn btn-quiet">Career Passport</Link>
        </div>
      </form>

      <AccountSecurityPanel />
    </div>
  );
}

function PrivacyToggle({ label, detail, checked, onChange }: { label: string; detail: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="privacy-row"><span><strong>{label}</strong><small>{detail}</small></span><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /></label>;
}
