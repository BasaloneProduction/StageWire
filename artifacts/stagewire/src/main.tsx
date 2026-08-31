import { createRoot } from 'react-dom/client';

import App from './App';
import { ErrorBoundary } from '@/components/error-boundary';

import './index.css';
import './bp-theme.css';
import './accessibility.css';

function appPath(pathname: string) {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return base && pathname.startsWith(base) ? pathname.slice(base.length) || '/' : pathname;
}

document.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const anchor = target.closest('a');
  if (!anchor) return;

  const url = new URL(anchor.href, window.location.origin);
  if (url.origin !== window.location.origin) return;
  const path = appPath(url.pathname);

  if (path === '/vault') {
    event.preventDefault();
    window.location.assign(`${import.meta.env.BASE_URL}vault-v14`);
    return;
  }

  if (path === '/passport') {
    event.preventDefault();
    window.location.assign(`${import.meta.env.BASE_URL}passport-v14`);
    return;
  }

  if (path !== '/finish') return;
  const callId = Number(url.searchParams.get('call'));
  if (!Number.isFinite(callId) || callId <= 0) return;

  event.preventDefault();
  const destination = appPath(window.location.pathname).startsWith('/workday/')
    ? `closeout/${callId}`
    : `workday/${callId}`;
  window.location.assign(`${import.meta.env.BASE_URL}${destination}`);
});

createRoot(document.getElementById('root')!, {
  onCaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack);
  },
}).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
