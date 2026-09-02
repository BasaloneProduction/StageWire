const STORAGE_KEY = 'stagewire-offline-outbox-v1';
const OUTBOX_EVENT = 'stagewire-outbox-change';

type OutboxEntry = {
  id: string;
  url: string;
  method: string;
  headers: Array<[string, string]>;
  body: string | null;
  label: string;
  createdAt: string;
};

type OutboxDetail = {
  pending: number;
  synced?: number;
  rejected?: number;
};

let nativeFetch: typeof window.fetch | null = null;
let installed = false;
let replaying = false;

export class OfflineQueuedError extends Error {
  readonly name = 'OfflineQueuedError';
  readonly actionId: string;

  constructor(actionId: string, label: string) {
    super(`${label} saved offline. StageWire will upload it when the connection returns.`);
    this.actionId = actionId;
  }
}

export function isOfflineQueuedError(error: unknown): error is OfflineQueuedError {
  return error instanceof Error && error.name === 'OfflineQueuedError';
}

function readQueue(): OutboxEntry[] {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function writeQueue(entries: OutboxEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function dispatch(detail: OutboxDetail) {
  window.dispatchEvent(new CustomEvent<OutboxDetail>(OUTBOX_EVENT, { detail }));
}

export function getOfflineOutboxCount() {
  return readQueue().length;
}

export function subscribeToOfflineOutbox(listener: (detail: OutboxDetail) => void) {
  const handler = (event: Event) => listener((event as CustomEvent<OutboxDetail>).detail);
  window.addEventListener(OUTBOX_EVENT, handler);
  return () => window.removeEventListener(OUTBOX_EVENT, handler);
}

function actionLabel(pathname: string) {
  if (pathname.endsWith('/arrive')) return 'Check-in';
  if (pathname.endsWith('/start')) return 'Paid work start';
  if (pathname.endsWith('/notes')) return 'Note';
  if (pathname.endsWith('/expenses')) return 'Expense';
  if (pathname.includes('/checklist/items')) return 'Checklist change';
  return 'Workday action';
}

function supportsOutbox(url: URL, method: string) {
  if (url.origin !== window.location.origin) return false;
  if (!/^\/api\/calls\/\d+\//.test(url.pathname)) return false;
  if (method === 'POST') {
    return /\/(arrive|start|notes|expenses|checklist\/items)$/.test(url.pathname);
  }
  return method === 'PATCH' && /\/checklist\/items\/\d+$/.test(url.pathname);
}

function actionId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `sw-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function requestBody(input: RequestInfo | URL, init?: RequestInit) {
  if (typeof init?.body === 'string') return init.body;
  if (input instanceof Request) return input.clone().text();
  return null;
}

function storableHeaders(headers: Headers) {
  const values: Array<[string, string]> = [];
  headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (lower !== 'authorization' && lower !== 'cookie') values.push([key, value]);
  });
  return values;
}

async function queueRequest(input: RequestInfo | URL, init: RequestInit, url: URL, method: string, headers: Headers) {
  const body = await requestBody(input, init);
  const existing = readQueue().find((entry) =>
    entry.url === url.toString()
    && entry.method === method
    && entry.body === body,
  );
  if (existing) throw new OfflineQueuedError(existing.id, existing.label);

  const id = headers.get('x-stagewire-action-id') || actionId();
  headers.set('x-stagewire-action-id', id);
  const entry: OutboxEntry = {
    id,
    url: url.toString(),
    method,
    headers: storableHeaders(headers),
    body,
    label: actionLabel(url.pathname),
    createdAt: new Date().toISOString(),
  };
  const queue = [...readQueue(), entry];
  writeQueue(queue);
  dispatch({ pending: queue.length });
  throw new OfflineQueuedError(id, entry.label);
}

export async function replayOfflineOutbox() {
  if (!nativeFetch || replaying || !navigator.onLine) return;
  replaying = true;
  let synced = 0;
  let rejected = 0;

  try {
    for (const entry of readQueue()) {
      try {
        const response = await nativeFetch(entry.url, {
          method: entry.method,
          headers: new Headers(entry.headers),
          body: entry.body,
          credentials: 'same-origin',
        });

        if (response.ok) {
          writeQueue(readQueue().filter((candidate) => candidate.id !== entry.id));
          synced += 1;
          continue;
        }

        if (response.status >= 400 && response.status < 500 && response.status !== 401 && response.status !== 403) {
          writeQueue(readQueue().filter((candidate) => candidate.id !== entry.id));
          rejected += 1;
          continue;
        }

        break;
      } catch {
        break;
      }
    }
  } finally {
    replaying = false;
    dispatch({ pending: readQueue().length, synced, rejected });
  }
}

export function installOfflineOutbox() {
  if (installed) return;
  installed = true;
  nativeFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const url = new URL(raw, window.location.origin);
    const method = String(init.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();

    if (!supportsOutbox(url, method)) return nativeFetch!(input, init);

    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    if (!headers.has('x-stagewire-action-id')) headers.set('x-stagewire-action-id', actionId());
    const nextInit = { ...init, method, headers };

    if (!navigator.onLine) return queueRequest(input, nextInit, url, method, headers);

    try {
      return await nativeFetch!(input, nextInit);
    } catch (error) {
      if (!navigator.onLine) return queueRequest(input, nextInit, url, method, headers);
      throw error;
    }
  };

  window.addEventListener('online', () => void replayOfflineOutbox());
  if (navigator.onLine) void replayOfflineOutbox();
}
