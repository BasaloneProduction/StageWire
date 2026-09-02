import { createRoot } from 'react-dom/client';

import App from './App';
import { ConnectionNotice } from '@/components/connection-notice';
import { ErrorBoundary } from '@/components/error-boundary';
import { InstallAppNotice } from '@/components/install-app-notice';
import { installDemoApi } from '@/demo-api';
import { installDemoCredentialApi } from '@/demo-credentials';
import { installDemoCrewKitApi } from '@/demo-crew-kit';
import { installDemoFileMetadataApi } from '@/demo-file-metadata';
import { installOfflineOutbox } from '@/offline-outbox';

import './index.css';
import './bp-theme.css';
import './accessibility.css';

installDemoApi();
installDemoCredentialApi();
installDemoCrewKitApi();
installDemoFileMetadataApi();
installOfflineOutbox();

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}stagewire-sw.js`, { scope: import.meta.env.BASE_URL })
      .catch((error) => console.warn('StageWire offline shell could not be registered.', error));
  });
}

function appPath(pathname: string) {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return base && pathname.startsWith(base) ? pathname.slice(base.length) || '/' : pathname;
}

const AUTH_MESSAGE_KEY = 'stagewire-auth-message';

async function completeSupabaseEmailSignIn() {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const accessToken = params.get('access_token');
  const providerError = params.get('error_description');
  if (!accessToken && !providerError) return;

  window.history.replaceState({}, '', `${window.location.pathname}${window.location.search}`);
  let message = providerError ? `That sign-in link did not work: ${providerError}` : '';

  if (accessToken) {
    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken }),
      });
      if (response.ok) {
        const result = await response.json() as { created?: boolean };
        message = result.created
          ? 'Worker account created and signed in.'
          : 'Signed in. Your worker records can follow you.';
      } else {
        const body = await response.json().catch(() => ({})) as { error?: string };
        message = body.error || 'StageWire could not finish that sign-in link.';
      }
    } catch {
      message = 'StageWire could not reach the sign-in service. Open the email link again when you have a signal.';
    }
  }

  sessionStorage.setItem(AUTH_MESSAGE_KEY, message);
  window.history.replaceState({}, '', `${import.meta.env.BASE_URL}worker-setup?signin=complete`);
}

function skipToMain() {
  const main = document.querySelector<HTMLElement>('main.main-area');
  if (!main) return;
  main.tabIndex = -1;
  main.focus();
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

function renderStageWire() {
  createRoot(document.getElementById('root')!, {
    onCaughtError: (error, errorInfo) => {
      console.error(error, errorInfo.componentStack);
    },
  }).render(
    <ErrorBoundary>
      <button className="skip-link print-hide" type="button" onClick={skipToMain}>Skip to main content</button>
      <div className="preview-safety-notice print-hide" role="note" aria-label="Preview safety notice">
        <strong>Preview build — no worker accounts yet.</strong>
        <span>Do not enter real personal, financial, or credential data on a shared or public deployment. Authentication and cross-device identity are still being built.</span>
      </div>
      <ConnectionNotice />
      <InstallAppNotice />
      <App />
    </ErrorBoundary>,
  );
}

void completeSupabaseEmailSignIn().finally(renderStageWire);
