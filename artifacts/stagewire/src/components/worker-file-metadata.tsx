import { useEffect, useState } from 'react';
import { BadgeCheck, FileText, ShieldCheck, Upload } from 'lucide-react';

type FileKind = 'certification' | 'document';
type FileRecord = {
  id: number;
  kind: FileKind | 'profile-photo';
  name: string;
  sizeBytes: number;
  mimeType: string;
  storageStatus: 'metadata' | 'stored';
  createdAt?: string;
  updatedAt?: string;
};
type LegacyFile = { name: string; size: number; type: string };
type LegacyFiles = { certifications: LegacyFile[]; documents: LegacyFile[] };

const LEGACY_FILES_KEY = 'stagewire-profile-files-v14';

function readLegacyFiles(): LegacyFiles {
  try {
    const raw = localStorage.getItem(LEGACY_FILES_KEY);
    if (raw) return { certifications: [], documents: [], ...JSON.parse(raw) };
  } catch {}
  return { certifications: [], documents: [] };
}

function prettySize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: 'same-origin',
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json', ...(init.headers || {}) } : init?.headers,
  });
  if (response.status === 204) return undefined as T;
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body?.error === 'string' ? body.error : 'StageWire could not save that file record.');
  return body as T;
}

async function listMetadata() {
  return api<FileRecord[]>('/api/file-metadata');
}

async function createMetadata(kind: FileKind, file: Pick<LegacyFile, 'name' | 'size' | 'type'>) {
  return api<FileRecord>('/api/file-metadata', {
    method: 'POST',
    body: JSON.stringify({ kind, name: file.name, sizeBytes: file.size, mimeType: file.type || '' }),
  });
}

async function deleteMetadata(id: number) {
  return api<void>(`/api/file-metadata/${id}`, { method: 'DELETE' });
}

export default function WorkerFileMetadataPanel() {
  const [records, setRecords] = useState<FileRecord[]>([]);
  const [legacy, setLegacy] = useState<LegacyFiles>(readLegacyFiles);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setRecords(await listMetadata());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'StageWire could not load your file list.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const addFiles = async (kind: FileKind, files: FileList | null) => {
    const selected = Array.from(files || []);
    if (selected.length === 0) return;
    setBusy(kind);
    setError('');
    try {
      const created: FileRecord[] = [];
      for (const file of selected) {
        created.push(await createMetadata(kind, file));
      }
      setRecords((current) => [...current, ...created]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'StageWire could not save that file list.');
      await load();
    } finally {
      setBusy(null);
    }
  };

  const remove = async (record: FileRecord) => {
    setBusy(`remove-${record.id}`);
    setError('');
    try {
      await deleteMetadata(record.id);
      setRecords((current) => current.filter((item) => item.id !== record.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'StageWire could not remove that file record.');
    } finally {
      setBusy(null);
    }
  };

  const legacyCount = legacy.certifications.length + legacy.documents.length;
  const importLegacy = async () => {
    if (legacyCount === 0) return;
    setBusy('legacy');
    setError('');
    try {
      const created: FileRecord[] = [];
      for (const file of legacy.certifications) created.push(await createMetadata('certification', file));
      for (const file of legacy.documents) created.push(await createMetadata('document', file));
      setRecords((current) => [...current, ...created]);
      localStorage.removeItem(LEGACY_FILES_KEY);
      setLegacy({ certifications: [], documents: [] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'StageWire could not move the old file list yet.');
      await load();
    } finally {
      setBusy(null);
    }
  };

  const bucket = (kind: FileKind, title: string, icon: React.ReactNode, accept: string) => {
    const items = records.filter((record) => record.kind === kind);
    return (
      <div className="upload-card">
        <div className="upload-icon">{icon}</div>
        <div>
          <h3>{title}</h3>
          <p className="help-text">These filenames and details follow your worker record across devices. File contents are not uploaded yet.</p>
          <label className={`btn btn-secondary file-button ${busy === kind ? 'disabled' : ''}`}>
            <Upload size={18} /> {busy === kind ? 'Saving…' : 'Add file names'}
            <input type="file" multiple accept={accept} disabled={busy !== null} onChange={(event) => { void addFiles(kind, event.target.files); event.currentTarget.value = ''; }} />
          </label>
          {loading ? <p className="help-text" style={{ marginTop: 12 }}>Loading saved file list…</p> : items.length === 0 ? <p className="help-text" style={{ marginTop: 12 }}>Nothing saved here yet.</p> : (
            <div className="selected-files">
              {items.map((record) => (
                <div className="selected-file" key={record.id}>
                  <span><b>{record.name}</b><small>{prettySize(record.sizeBytes)} · filename + details only</small></span>
                  <button type="button" className="btn btn-quiet" disabled={busy !== null} onClick={() => void remove(record)}>{busy === `remove-${record.id}` ? 'Removing…' : 'Remove'}</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {legacyCount > 0 && (
        <div className="card card-pad" style={{ gridColumn: '1 / -1' }}>
          <div className="eyebrow">Old browser file list found</div>
          <h3 style={{ marginTop: 7 }}>Move {legacyCount} filename{legacyCount === 1 ? '' : 's'} into your worker record?</h3>
          <p className="help-text">This moves filename, size, and file-type metadata only. It does not upload the underlying files.</p>
          <div className="form-actions" style={{ marginTop: 14 }}><button type="button" className="btn btn-secondary" disabled={busy !== null} onClick={() => void importLegacy()}>{busy === 'legacy' ? 'Moving…' : 'Move old file list'}</button></div>
        </div>
      )}
      {error && <div className="error-box" role="alert" style={{ gridColumn: '1 / -1' }}><strong>{error}</strong></div>}
      <div className="privacy-rule" style={{ gridColumn: '1 / -1' }}><ShieldCheck size={19} /><span>StageWire stores only the file record here. Keep the actual PDF/photo somewhere safe until secure object storage is wired.</span></div>
      {bucket('certification', 'Certification file list', <BadgeCheck size={24} />, 'image/*,.pdf')}
      {bucket('document', 'Document file list', <FileText size={24} />, 'image/*,.pdf,.doc,.docx')}
    </>
  );
}
