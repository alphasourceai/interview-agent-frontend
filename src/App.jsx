import React from 'react';
import { Routes, Route } from 'react-router-dom';

import SignIn from './pages/SignIn';                  // ⬅ add
import InterviewAccessPage from './pages/InterviewAccessPage';
import VerifyOtp from './pages/VerifyOtp';
import ClientDashboard from './pages/ClientDashboard';
import RoleCreator from './pages/RoleCreator';
import RoleReports from './pages/RoleReports';
import RoleCandidates from './pages/RoleCandidates';

function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/signin" element={<SignIn />} />    {/* ⬅ add */}
      <Route path="/interview-access/:role_token" element={<InterviewAccessPage />} />
      <Route path="/verify-otp" element={<VerifyOtp />} />

      {/* Legacy single-page dashboard & role views */}
      <Route path="/dashboard" element={<ClientDashboard />} />
      <Route path="/create-role" element={<RoleCreator />} />
      <Route path="/reports/:roleId" element={<RoleReports />} />
      <Route path="/candidates/:roleId" element={<RoleCandidates />} />
    </Routes>
  );
}

export default App;
