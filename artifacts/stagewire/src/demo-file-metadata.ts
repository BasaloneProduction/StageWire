type DemoFileKind = 'certification' | 'document' | 'profile-photo';
type DemoFileRecord = {
  id: number;
  kind: DemoFileKind;
  name: string;
  sizeBytes: number;
  mimeType: string;
  storageStatus: 'metadata' | 'stored';
  createdAt: string;
  updatedAt: string;
};

const KEY = 'stagewire-demo-file-metadata-server-v14';
const KINDS = new Set<DemoFileKind>(['certification', 'document', 'profile-photo']);
const MAX_SIZE = 1024 * 1024 * 1024;

function load(): DemoFileRecord[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((record): record is DemoFileRecord => Boolean(
      record && typeof record === 'object' && Number.isInteger(record.id) && record.id > 0 &&
      KINDS.has(record.kind) && typeof record.name === 'string' && typeof record.sizeBytes === 'number' &&
      typeof record.mimeType === 'string' && (record.storageStatus === 'metadata' || record.storageStatus === 'stored'),
    ));
  } catch {
    return [];
  }
}

function save(records: DemoFileRecord[]) {
  localStorage.setItem(KEY, JSON.stringify(records));
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

function body(init?: RequestInit) {
  if (!init?.body || typeof init.body !== 'string') return {} as Record<string, unknown>;
  try { return JSON.parse(init.body) as Record<string, unknown>; } catch { return {}; }
}

function cleanKind(value: unknown): DemoFileKind | null {
  const kind = typeof value === 'string' ? value.trim() as DemoFileKind : '' as DemoFileKind;
  return KINDS.has(kind) ? kind : null;
}

function cleanName(value: unknown) {
  const name = typeof value === 'string' ? value.trim() : '';
  return name && name.length <= 255 ? name : null;
}

function cleanSize(value: unknown) {
  const size = Number(value ?? 0);
  return Number.isInteger(size) && size >= 0 && size <= MAX_SIZE ? size : null;
}

export function installDemoFileMetadataApi() {
  if (!import.meta.env.DEV || import.meta.env.VITE_REAL_API === 'true') return;
  const previousFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const url = new URL(raw, window.location.origin);
    if (url.origin !== window.location.origin || !url.pathname.startsWith('/api/file-metadata')) return previousFetch(input, init);

    const method = String(init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const records = load();

    if (url.pathname === '/api/file-metadata' && method === 'GET') {
      const requestedKind = url.searchParams.get('kind');
      if (requestedKind !== null) {
        const kind = cleanKind(requestedKind);
        if (!kind) return json({ error: 'Unknown file metadata kind.' }, 400);
        return json(records.filter((record) => record.kind === kind));
      }
      return json(records);
    }

    if (url.pathname === '/api/file-metadata' && method === 'POST') {
      const data = body(init);
      const kind = cleanKind(data.kind);
      const name = cleanName(data.name);
      const sizeBytes = cleanSize(data.sizeBytes);
      const mimeType = typeof data.mimeType === 'string' ? data.mimeType.trim().slice(0, 200) : '';
      if (!kind || !name || sizeBytes === null) return json({ error: 'Check the file type, filename, and size before saving.' }, 400);

      if (kind !== 'profile-photo') {
        const existing = records.find((record) => record.kind === kind && record.name === name && record.sizeBytes === sizeBytes && record.mimeType === mimeType && record.storageStatus === 'metadata');
        if (existing) return json(existing, 200);
      }

      const nextRecords = kind === 'profile-photo'
        ? records.filter((record) => !(record.kind === 'profile-photo' && record.storageStatus === 'metadata'))
        : [...records];
      const now = new Date().toISOString();
      const created: DemoFileRecord = {
        id: Math.max(0, ...nextRecords.map((record) => record.id)) + 1,
        kind,
        name,
        sizeBytes,
        mimeType,
        storageStatus: 'metadata',
        createdAt: now,
        updatedAt: now,
      };
      nextRecords.push(created);
      save(nextRecords);
      return json(created, 201);
    }

    const match = /^\/api\/file-metadata\/(\d+)$/.exec(url.pathname);
    if (match && method === 'DELETE') {
      const id = Number(match[1]);
      const existing = records.find((record) => record.id === id);
      if (!existing) return json({ error: 'File record not found.' }, 404);
      if (existing.storageStatus === 'stored') return json({ error: 'Stored file removal is not enabled until secure object deletion is wired.' }, 409);
      save(records.filter((record) => record.id !== id));
      return new Response(null, { status: 204 });
    }

    return json({ error: 'Demo file metadata method not supported.' }, 405);
  };
}
