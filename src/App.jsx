import React from 'react';
import { Routes, Route } from 'react-router-dom';
import InterviewAccessPage from './pages/InterviewAccessPage';
import VerifyOtp from './pages/VerifyOtp';
import TestRLS from './pages/TestRLS';

function App() {
  return (
    <Routes>
      <Route path="/interview-access/:role_token" element={<InterviewAccessPage />} />
      <Route path="/verify-otp" element={<VerifyOtp />} />
      <Route path="/rls-test" element={<TestRLS />} />
      <Route path="*" element={<div style={{ padding: 50 }}>Fallback route hit</div>} />
    </Routes>
  );
}

export default App;
