type DemoCrewKitItem = { id: string; role: string; label: string };
type DemoCrewKitState = { customItems: DemoCrewKitItem[]; readyMarks: string[] };

const KEY = 'stagewire-demo-crew-kit-server-v14';

function load(): DemoCrewKitState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { customItems: [], readyMarks: [] };
    const parsed = JSON.parse(raw);
    return {
      customItems: Array.isArray(parsed.customItems) ? parsed.customItems : [],
      readyMarks: Array.isArray(parsed.readyMarks) ? parsed.readyMarks : [],
    };
  } catch {
    return { customItems: [], readyMarks: [] };
  }
}

function save(state: DemoCrewKitState) {
  localStorage.setItem(KEY, JSON.stringify(state));
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

function requestBody(init?: RequestInit) {
  if (!init?.body || typeof init.body !== 'string') return {};
  try { return JSON.parse(init.body) as Record<string, unknown>; } catch { return {}; }
}

function cleanState(data: Record<string, unknown>): DemoCrewKitState | null {
  if (!Array.isArray(data.customItems) || !Array.isArray(data.readyMarks)) return null;
  const customItems: DemoCrewKitItem[] = [];
  const ids = new Set<string>();
  for (const value of data.customItems) {
    if (!value || typeof value !== 'object') return null;
    const record = value as Record<string, unknown>;
    const item = {
      id: String(record.id || '').trim(),
      role: String(record.role || '').trim(),
      label: String(record.label || '').trim(),
    };
    if (!item.id || !item.role || !item.label || item.id.length > 100 || item.role.length > 80 || item.label.length > 160 || ids.has(item.id)) return null;
    ids.add(item.id);
    customItems.push(item);
  }
  if (customItems.length > 200) return null;
  const readyMarks = Array.from(new Set(data.readyMarks.map((value) => String(value || '').trim()).filter(Boolean)));
  if (readyMarks.length > 500 || readyMarks.some((mark) => mark.length > 220)) return null;
  return { customItems, readyMarks };
}

export function installDemoCrewKitApi() {
  if (!import.meta.env.DEV || import.meta.env.VITE_REAL_API === 'true') return;
  const previousFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const url = new URL(raw, window.location.origin);
    if (url.origin !== window.location.origin || url.pathname !== '/api/crew-kit-state') return previousFetch(input, init);

    const method = String(init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    if (method === 'GET') return json(load());
    if (method === 'PUT') {
      const next = cleanState(requestBody(init));
      if (!next) return json({ error: 'Check the Crew Kit items and ready marks before saving.' }, 400);
      save(next);
      return json(next);
    }
    return json({ error: 'Demo Crew Kit method not supported.' }, 405);
  };
}
