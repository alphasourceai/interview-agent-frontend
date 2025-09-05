import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import InterviewAccessPage from './pages/InterviewAccessPage';
import VerifyOtp from './pages/VerifyOtp';
import ClientDashboard from './pages/ClientDashboard';

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
    {/* Theme wrapper applies the Wix-matched colors/fonts */}
    <div className="alpha-theme min-h-screen">
      <Routes>
        {/* Default → dashboard (single page) */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        {/* Public routes used by your magic-link / access flows */}
        <Route path="/interview-access/:role_token" element={<InterviewAccessPage />} />
        <Route path="/verify-otp" element={<VerifyOtp />} />

        {/* Single dashboard page */}
        <Route path="/dashboard" element={<ClientDashboard />} />

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  );
}
