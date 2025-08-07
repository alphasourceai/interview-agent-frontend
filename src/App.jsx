import React from 'react';
import { Routes, Route } from 'react-router-dom';
import InterviewAccessPage from './pages/InterviewAccessPage';
import VerifyOtp from './pages/VerifyOtp';
import TestRLS from './pages/TestRLS'; // ✅ New import

function App() {
  return (
    <Routes>
      <Route path="/interview-access/:role_token" element={<InterviewAccessPage />} />
      <Route path="/verify-otp" element={<VerifyOtp />} />
      <Route path="/test-rls" element={<TestRLS />} /> {/* ✅ New route */}
    </Routes>
  );
}

export default App;
