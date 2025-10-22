// src/main.jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'

import * as Sentry from '@sentry/react'

import './styles/alphaTheme.css'

// Public pages
import SignIn from './pages/SignIn.jsx'
import VerifyOtp from './pages/VerifyOtp.jsx'
import InterviewAccessPage from './pages/InterviewAccessPage.jsx'
import Admin from './pages/Admin.jsx'


// Legacy single-page dashboard + role views
import ClientDashboard from './pages/ClientDashboard.jsx'
import RoleCreator from './pages/RoleCreator.jsx'
import RoleReports from './pages/RoleReports.jsx'
import RoleCandidates from './pages/RoleCandidates.jsx'

// Auth guard
import ProtectedRoute from './components/ProtectedRoute.jsx'

import { supabase } from './lib/supabaseClient'
import { useEffect } from 'react'

// --- Sentry (frontend) ---
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.VITE_SENTRY_ENV || import.meta.env.MODE || 'production',
    release: import.meta.env.VITE_COMMIT_SHA || (typeof __COMMIT_SHA__ !== 'undefined' ? __COMMIT_SHA__ : undefined),
    tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE ?? 0.02), // low perf sample rate by default
    beforeSend(event) {
      try {
        // Basic PII scrubbing for URLs and strings
        const scrub = (s) =>
          typeof s === 'string'
            ? s
                .replace(/[^@\s]+@[^@\s]+\.[^@\s]+/g, '***@***')
                .replace(/(X-Amz-Signature|Signature)=[^&]+/g, '$1=REDACTED')
            : s
        if (event.request?.url) event.request.url = scrub(event.request.url)
      } catch {}
      return event
    },
  })

  // Capture global errors that may bypass React boundaries (e.g., router render failures)
  window.onerror = (message, source, lineno, colno, error) => {
    try { Sentry.captureException(error || new Error(String(message))); } catch {}
  };
  window.onunhandledrejection = (event) => {
    try { Sentry.captureException(event?.reason || new Error('Unhandled promise rejection')); } catch {}
  };
}

// --- Wix auto-resize for embedded mode (ResizeObserver, no inner scrollbars) ---
(function () {
  if (window === window.parent) return; // only when embedded

  // Tag document as embedded and prevent inner scrollbars
  try {
    document.documentElement.classList.add('embedded');
    if (document.body) document.body.style.overflow = 'hidden';
  } catch {}

  const root = document.getElementById('root') || document.documentElement;

  const postSize = () => {
    // Use root.scrollHeight so expanded content is included
    const h = Math.max(600, Math.min(6000, Math.ceil(root.scrollHeight)));
    window.parent.postMessage({ type: 'EMBED_SIZE', height: h }, '*');
  };

  // Observe size changes of the root for stable updates
  try {
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(postSize);
    });
    ro.observe(root);
  } catch {
    // Fallback: minimal listeners
    window.addEventListener('resize', () => setTimeout(postSize, 50));
    const mo = new MutationObserver(() => setTimeout(postSize, 50));
    mo.observe(root, { childList: true, subtree: true });
  }

  // Initial measure
  window.addEventListener('load', () => setTimeout(postSize, 30));
  setTimeout(postSize, 60);

  // Manual trigger API for pages (Start Interview, toggles, etc.)
  window.__EMBED__ = { updateSize: postSize };
})();

// --- Embedded interview token bridge (from Wix wrapper -> app) ---
(function () {
  if (window === window.parent) return; // only when embedded
  window.addEventListener('message', (e) => {
    const data = e?.data;
    if (data && data.type === 'ROLE_TOKEN' && typeof data.token === 'string' && data.token.length > 0) {
      const target = `/interview-access/${encodeURIComponent(data.token)}`;
      if (window.location.pathname !== target) {
        window.location.replace(target); // ensure loaders run
      }
    }
  });
})();

// --- Fallback: allow /interview-access?role=<uuid> to redirect to /interview-access/<uuid> ---
(function () {
  try {
    const u = new URL(window.location.href);
    const role = u.searchParams.get('role');
    if (role && window.location.pathname === '/interview-access') {
      window.location.replace(`/interview-access/${encodeURIComponent(role)}`);
    }
  } catch {}
})();

const router = createBrowserRouter([
  // default → dashboard (single page)
  { path: '/', element: <ProtectedRoute><ClientDashboard /></ProtectedRoute> },

  // public
  { path: '/signin', element: <SignIn /> },
  { path: '/verify-otp', element: <VerifyOtp /> },
  { path: '/interview-access', element: <InterviewAccessPage /> },
  { path: '/interview-access/:role_token', element: <InterviewAccessPage /> },
  { path: '/admin', element: <Admin /> },

  // legacy single-page + role views
  { path: '/dashboard', element: <ProtectedRoute><ClientDashboard /></ProtectedRoute> },
  { path: '/create-role', element: <ProtectedRoute><RoleCreator /></ProtectedRoute> },
  { path: '/reports/:roleId', element: <ProtectedRoute><RoleReports /></ProtectedRoute> },
  { path: '/candidates/:roleId', element: <ProtectedRoute><RoleCandidates /></ProtectedRoute> },

  // catch-all → dashboard
  { path: '*', element: <Navigate to="/dashboard" replace /> },
])

function SessionRecoveryWrapper({ children }) {
  useEffect(() => {
    async function recoverSession() {
      try {
        const { data, error } = await supabase.auth.getSession()
        if (error || !data?.session) {
          await supabase.auth.refreshSession()
        }
      } catch (e) {
        console.warn('Session recovery failed:', e)
      }
    }
    recoverSession()
  }, [])
  return <>{children}</>
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Sentry.ErrorBoundary fallback={<div style={{ padding: 16 }}>Something went wrong. Please refresh and try again.</div>}>
      <SessionRecoveryWrapper>
        <div style={{ height: '100vh', overflow: 'hidden' }}>
          <RouterProvider router={router} />
        </div>
      </SessionRecoveryWrapper>
    </Sentry.ErrorBoundary>
  </React.StrictMode>
)
