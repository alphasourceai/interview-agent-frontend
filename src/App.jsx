import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import ProtectedRoute from './components/ProtectedRoute.jsx';

import ClientDashboard from './pages/ClientDashboard.jsx';
import InterviewAccessPage from './pages/InterviewAccessPage.jsx';
import VerifyOtp from './pages/VerifyOtp.jsx';
import SignIn from './pages/SignIn.jsx';          // magic link entry
import AcceptInvite from './pages/AcceptInvite.jsx'; // optional, if you use invites

function NotFound() {
  return (
    <div style={{ padding: 32 }}>
      <h2>Page not found</h2>
      <p>We couldn’t find that page.</p>
      <a className="btn" href="/dashboard">Go to dashboard</a>
    </div>
  );
}

export default function App() {
  return (
    <div className="alpha-theme min-h-screen">
      {/* Theme wrapper applies the Wix-matched colors/fonts */}
      <Routes>
        {/* default → dashboard */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        {/* public auth & access */}
        <Route path="/signin" element={<SignIn />} />
        <Route path="/accept-invite" element={<AcceptInvite />} />
        <Route path="/interview-access/:role_token" element={<InterviewAccessPage />} />
        <Route path="/verify-otp" element={<VerifyOtp />} />

        {/* single-page dashboard (protected) */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <ClientDashboard />
            </ProtectedRoute>
          }
        />

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  );
}
