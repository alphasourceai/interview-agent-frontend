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
}

// --- Wix auto-resize for embedded mode ---
(function () {
  // Only when this app is inside an iframe (e.g., Wix HTML Embed)
  if (window === window.parent) return;
  const postSize = () => {
    const h = Math.max(
      document.documentElement.scrollHeight,
      document.body?.scrollHeight || 0,
      document.documentElement.offsetHeight
    );
    window.parent.postMessage({ type: 'EMBED_SIZE', height: h }, '*');
  };
  // Initial + window resizes
  window.addEventListener('load', postSize);
  window.addEventListener('resize', () => setTimeout(postSize, 50));
  // React route/content changes
  const obs = new MutationObserver(() => setTimeout(postSize, 50));
  obs.observe(document.documentElement, { childList: true, subtree: true });
  // Expose manual trigger for pages (e.g., after "Start Interview")
  window.__EMBED__ = { updateSize: postSize };
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

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Sentry.ErrorBoundary fallback={<div style={{ padding: 16 }}>Something went wrong. Please refresh and try again.</div>}>
      <RouterProvider router={router} />
    </Sentry.ErrorBoundary>
  </React.StrictMode>
)
