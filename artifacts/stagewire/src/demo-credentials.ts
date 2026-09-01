type DemoCredential = {
  id: number;
  name: string;
  issuer: string;
  expires: string | null;
  status: 'current' | 'planned';
  createdAt: string;
  updatedAt: string;
};

type DemoCredentialState = { credentials: DemoCredential[]; nextId: number };

const KEY = 'stagewire-demo-credentials-v14';

function load(): DemoCredentialState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { credentials: [], nextId: 1 };
    const parsed = JSON.parse(raw);
    return {
      credentials: Array.isArray(parsed.credentials) ? parsed.credentials : [],
      nextId: Number.isInteger(parsed.nextId) && parsed.nextId > 0 ? parsed.nextId : 1,
    };
  } catch {
    return { credentials: [], nextId: 1 };
  }
}

function save(state: DemoCredentialState) {
  localStorage.setItem(KEY, JSON.stringify(state));
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

function requestBody(init?: RequestInit) {
  if (!init?.body || typeof init.body !== 'string') return {};
  try { return JSON.parse(init.body) as Record<string, unknown>; } catch { return {}; }
}

function cleanDate(value: unknown) {
  const text = typeof value === 'string' ? value.trim() : '';
  return text ? text.slice(0, 10) : null;
}

export function installDemoCredentialApi() {
  if (!import.meta.env.DEV || import.meta.env.VITE_REAL_API === 'true') return;
  const previousFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const url = new URL(raw, window.location.origin);
    if (url.origin !== window.location.origin || !url.pathname.startsWith('/api/credentials')) {
      return previousFetch(input, init);
    }

    const method = String(init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const state = load();

    if (url.pathname === '/api/credentials' && method === 'GET') return json(state.credentials);
    if (url.pathname === '/api/credentials' && method === 'POST') {
      const data = requestBody(init);
      const name = String(data.name || '').trim();
      if (!name) return json({ error: 'Add the credential name before saving.' }, 400);
      const now = new Date().toISOString();
      const credential: DemoCredential = {
        id: state.nextId++,
        name,
        issuer: String(data.issuer || '').trim(),
        expires: cleanDate(data.expires),
        status: data.status === 'planned' ? 'planned' : 'current',
        createdAt: now,
        updatedAt: now,
      };
      state.credentials.push(credential);
      save(state);
      return json(credential, 201);
    }

    const match = url.pathname.match(/^\/api\/credentials\/(\d+)$/);
    if (!match) return json({ error: 'Demo credential route not found.' }, 404);
    const id = Number(match[1]);
    const index = state.credentials.findIndex((credential) => credential.id === id);
    if (index < 0) return json({ error: 'Credential not found.' }, 404);

    if (method === 'PATCH') {
      const data = requestBody(init);
      const current = state.credentials[index];
      const name = data.name === undefined ? current.name : String(data.name || '').trim();
      if (!name) return json({ error: 'Credential name cannot be blank.' }, 400);
      const next: DemoCredential = {
        ...current,
        name,
        issuer: data.issuer === undefined ? current.issuer : String(data.issuer || '').trim(),
        expires: data.expires === undefined ? current.expires : cleanDate(data.expires),
        status: data.status === undefined ? current.status : data.status === 'planned' ? 'planned' : 'current',
        updatedAt: new Date().toISOString(),
      };
      state.credentials[index] = next;
      save(state);
      return json(next);
    }

    if (method === 'DELETE') {
      state.credentials.splice(index, 1);
      save(state);
      return new Response(null, { status: 204 });
    }

    return json({ error: 'Demo credential method not supported.' }, 405);
  };
}
