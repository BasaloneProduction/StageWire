import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, Camera, CheckCircle2, FileText, LockKeyhole, Save, ShieldCheck, Upload, UserRound } from 'lucide-react';
import { Link } from 'wouter';
import {
  getGetPassportQueryKey,
  getGetProfileQueryKey,
  useGetProfile,
  useUpdateProfile,
  type ProfileInput,
} from '@workspace/api-client-react';

type ShareSettings = {
  sharePhoto: boolean;
  shareHomeBase: boolean;
  shareSkills: boolean;
  shareCertifications: boolean;
};

type LocalFile = { name: string; size: number; type: string };

const SHARE_KEY = 'stagewire-share-settings-v14';
const FILES_KEY = 'stagewire-profile-files-v14';
const PHOTO_KEY = 'stagewire-profile-photo-preview-v14';

function readShareSettings(): ShareSettings {
  try {
    const raw = localStorage.getItem(SHARE_KEY);
    if (raw) return { sharePhoto: false, shareHomeBase: false, shareSkills: true, shareCertifications: true, ...JSON.parse(raw) };
  } catch {}
  return { sharePhoto: false, shareHomeBase: false, shareSkills: true, shareCertifications: true };
}

function readFiles(): { certifications: LocalFile[]; documents: LocalFile[] } {
  try {
    const raw = localStorage.getItem(FILES_KEY);
    if (raw) return { certifications: [], documents: [], ...JSON.parse(raw) };
  } catch {}
  return { certifications: [], documents: [] };
}

function fileMeta(files: FileList | null): LocalFile[] {
  return Array.from(files || []).map((file) => ({ name: file.name, size: file.size, type: file.type || 'file' }));
}

function prettySize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function WorkerSetupPage() {
  const profile = useGetProfile();
  const updateProfile = useUpdateProfile();
  const client = useQueryClient();
  const [saved, setSaved] = useState(false);
  const [share, setShare] = useState<ShareSettings>(readShareSettings);
  const [files, setFiles] = useState(readFiles);
  const [photoName, setPhotoName] = useState('');
  const [photoPreview, setPhotoPreview] = useState(() => localStorage.getItem(PHOTO_KEY) || '');

  const worker = profile.data;
  const completion = useMemo(() => {
    if (!worker) return 0;
    const checks = [worker.displayName, worker.primaryRole, worker.homeCityState, worker.skills.length, worker.certifications.length];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [worker]);

  if (profile.isLoading) return <div className="page-wrap"><div className="card card-pad"><h2>Opening worker setup…</h2></div></div>;
  if (profile.isError || !worker) return <div className="page-wrap"><div className="error-box"><strong>Worker setup could not load.</strong><button className="btn btn-quiet" onClick={() => profile.refetch()}>Try again</button></div></div>;

  const saveShare = (next: ShareSettings) => {
    setShare(next);
    localStorage.setItem(SHARE_KEY, JSON.stringify(next));
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

  const pickFiles = (kind: 'certifications' | 'documents', selected: FileList | null) => {
    const next = { ...files, [kind]: [...files[kind], ...fileMeta(selected)] };
    setFiles(next);
    localStorage.setItem(FILES_KEY, JSON.stringify(next));
  };

  const removeFile = (kind: 'certifications' | 'documents', index: number) => {
    const next = { ...files, [kind]: files[kind].filter((_, i) => i !== index) };
    setFiles(next);
    localStorage.setItem(FILES_KEY, JSON.stringify(next));
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
      certifications: String(form.get('certifications') || '').split(',').map((item) => item.trim()).filter(Boolean),
      bio: String(form.get('bio') || '').trim() || null,
      emergencyContact: String(form.get('emergencyContact') || '').trim() || null,
      profilePhotoName: photoName || worker.profilePhotoName,
    };

    updateProfile.mutate({ data: payload }, {
      onSuccess: (result) => {
        client.setQueryData(getGetProfileQueryKey(), result);
        client.invalidateQueries({ queryKey: getGetProfileQueryKey() });
        client.invalidateQueries({ queryKey: getGetPassportQueryKey() });
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
          <div className="setup-section-head"><span className="setup-step">3</span><div><div className="eyebrow">Professional record</div><h2>Skills & credentials</h2><p className="subtitle">This is what can build your Career Passport.</p></div></div>
          <div className="form-grid">
            <div className="field full"><label htmlFor="skills">Skills</label><input id="skills" name="skills" defaultValue={worker.skills.join(', ')} placeholder="Rigging, cable, video wall, forklift" /></div>
            <div className="field full"><label htmlFor="certifications">Certifications</label><input id="certifications" name="certifications" defaultValue={worker.certifications.join(', ')} placeholder="OSHA 10, CPR, Fall Protection" /></div>
            <div className="field full"><label htmlFor="bio">Short professional bio</label><textarea id="bio" name="bio" defaultValue={worker.bio || ''} placeholder="A few useful lines. No résumé essay required." /></div>
          </div>
        </section>

        <section className="card card-pad setup-section">
          <div className="setup-section-head"><span className="setup-step">4</span><div><div className="eyebrow">File preview</div><h2>Choose what you want StageWire to remember.</h2><p className="subtitle">This build remembers certification/document filenames and file details only. It does not yet store or upload those file contents. Secure file storage must be wired before production launch.</p></div></div>
          <div className="privacy-rule" style={{ marginBottom: 18 }}><ShieldCheck size={20} /><strong>Do not rely on this preview as your only copy of a certification or document.</strong></div>
          <div className="upload-grid">
            <div className="upload-card">
              <div className="upload-preview">{photoPreview ? <img src={photoPreview} alt="Profile preview" /> : <UserRound size={44} />}</div>
              <div><h3>Profile photo</h3><p className="help-text">Optional. Photo preview data is kept locally in this browser for the current build. You decide whether it appears on a shared Passport.</p><label className="btn btn-secondary file-button"><Camera size={18} /> Choose photo<input type="file" accept="image/*" onChange={pickPhoto} /></label>{(photoName || worker.profilePhotoName) && <div className="file-name">{photoName || worker.profilePhotoName}</div>}</div>
            </div>
            <UploadBucket title="Certification file list" icon={<BadgeCheck size={24} />} accept="image/*,.pdf" files={files.certifications} onPick={(list) => pickFiles('certifications', list)} onRemove={(index) => removeFile('certifications', index)} />
            <UploadBucket title="Document file list" icon={<FileText size={24} />} accept="image/*,.pdf,.doc,.docx" files={files.documents} onPick={(list) => pickFiles('documents', list)} onRemove={(index) => removeFile('documents', index)} />
          </div>
        </section>

        <section className="card card-pad setup-section">
          <div className="setup-section-head"><span className="setup-step">5</span><div><div className="eyebrow">Sharing controls</div><h2>You choose what leaves the Vault.</h2><p className="subtitle">These settings affect Career Passport preview only. Private contact information is not included.</p></div></div>
          <div className="privacy-list">
            <PrivacyToggle label="Profile photo" detail="Off by default" checked={share.sharePhoto} onChange={(value) => saveShare({ ...share, sharePhoto: value })} />
            <PrivacyToggle label="Home base" detail="City/state only" checked={share.shareHomeBase} onChange={(value) => saveShare({ ...share, shareHomeBase: value })} />
            <PrivacyToggle label="Skills" detail="Professional capabilities" checked={share.shareSkills} onChange={(value) => saveShare({ ...share, shareSkills: value })} />
            <PrivacyToggle label="Certifications" detail="Credential names, not private files" checked={share.shareCertifications} onChange={(value) => saveShare({ ...share, shareCertifications: value })} />
          </div>
          <div className="privacy-rule"><ShieldCheck size={20} /><strong>Phone, email, emergency contact, and uploaded files remain private.</strong></div>
        </section>

        {updateProfile.error && <div className="error-box" role="alert"><strong>{(updateProfile.error as Error).message || 'Profile could not be saved.'}</strong></div>}

        <div className="sticky-save-bar">
          <div><strong>No setup maze.</strong><span>Save what you have and get back to work.</span></div>
          <button className="btn btn-primary" type="submit" disabled={updateProfile.isPending}>{updateProfile.isPending ? 'Saving…' : <><Save size={18} /> Save worker setup</>}</button>
          <Link href="/passport" className="btn btn-quiet">Career Passport</Link>
        </div>
      </form>
    </div>
  );
}

function PrivacyToggle({ label, detail, checked, onChange }: { label: string; detail: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="privacy-row"><span><strong>{label}</strong><small>{detail}</small></span><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /></label>;
}

function UploadBucket({ title, icon, accept, files, onPick, onRemove }: { title: string; icon: React.ReactNode; accept: string; files: LocalFile[]; onPick: (files: FileList | null) => void; onRemove: (index: number) => void }) {
  return <div className="upload-card"><div className="upload-icon">{icon}</div><div><h3>{title}</h3><p className="help-text">Choose files to remember their names and details in this preview. File contents are not stored yet.</p><label className="btn btn-secondary file-button"><Upload size={18} /> Choose files<input type="file" multiple accept={accept} onChange={(e) => onPick(e.target.files)} /></label>{files.length > 0 && <div className="selected-files">{files.map((file, index) => <div className="selected-file" key={`${file.name}-${index}`}><span><b>{file.name}</b><small>{prettySize(file.size)} · filename only</small></span><button type="button" className="btn btn-quiet" onClick={() => onRemove(index)}>Remove</button></div>)}</div>}</div></div>;
}
