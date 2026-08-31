import { createRoot } from 'react-dom/client';

import App from './App';
import { ErrorBoundary } from '@/components/error-boundary';

import './index.css';

function appPath(pathname: string) {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return base && pathname.startsWith(base) ? pathname.slice(base.length) || '/' : pathname;
}

// V1.4 worker-flow bridge. The legacy app still points open-call actions at
// /finish?call=:id. Route those actions through Active Call first. When the
// worker finishes from the workday screen, fetch the saved workday and carry
// the paid start, notes, and already-logged expenses into the closeout form.
document.addEventListener('click', async (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const anchor = target.closest('a');
  if (!anchor) return;

  const url = new URL(anchor.href, window.location.origin);
  if (url.origin !== window.location.origin || appPath(url.pathname) !== '/finish') return;

  const callId = Number(url.searchParams.get('call'));
  if (!Number.isFinite(callId) || callId <= 0) return;

  event.preventDefault();

  if (!appPath(window.location.pathname).startsWith('/workday/')) {
    window.location.assign(`${import.meta.env.BASE_URL}workday/${callId}`);
    return;
  }

  try {
    const response = await fetch(`${import.meta.env.BASE_URL}api/calls/${callId}/workday`);
    if (response.ok) {
      const workday = await response.json();
      sessionStorage.setItem(`stagewire-finish-${callId}`, JSON.stringify({
        actualStart: workday.call?.actualStart ?? null,
        arrivalAt: workday.call?.arrivalAt ?? null,
        expenseAmount: workday.call?.expenseAmount ?? 0,
        notes: Array.isArray(workday.notes) ? workday.notes.map((note: { text?: string }) => note.text).filter(Boolean) : [],
      }));
    }
  } catch (error) {
    console.warn('Could not preload the StageWire workday for closeout.', error);
  }

  window.location.assign(`${import.meta.env.BASE_URL}finish?call=${callId}`);
});

createRoot(document.getElementById('root')!, {
  // Keeps caught errors off reportError(), which would raise the dev overlay.
  onCaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack);
  },
}).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
