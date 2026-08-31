import { createRoot } from 'react-dom/client';

import App from './App';
import { ErrorBoundary } from '@/components/error-boundary';

import './index.css';

// V1.4 worker-flow bridge. The legacy app still points open-call actions at
// /finish?call=:id. Until those screens are fully extracted from App.tsx,
// route those actions through the new Active Call workday first. Once the
// worker is already on /workday/:id, the Finish Call action is allowed through.
document.addEventListener('click', (event) => {
  if (window.location.pathname.startsWith('/workday/')) return;
  const target = event.target;
  if (!(target instanceof Element)) return;
  const anchor = target.closest('a');
  if (!anchor) return;

  const url = new URL(anchor.href, window.location.origin);
  if (url.origin !== window.location.origin || url.pathname !== '/finish') return;

  const callId = Number(url.searchParams.get('call'));
  if (!Number.isFinite(callId) || callId <= 0) return;

  event.preventDefault();
  window.location.assign(`/workday/${callId}`);
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
