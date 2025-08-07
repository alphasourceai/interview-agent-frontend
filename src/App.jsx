// src/App.jsx
import React from 'react';
import { Routes, Route } from 'react-router-dom';
import InterviewAccessPage from './pages/InterviewAccessPage';
import VerifyOtp from './pages/VerifyOtp';
import TestRLS from './pages/TestRLS';
import Demo from './pages/Demo'; // ✅ NEW

function App() {
  return (
    <Routes>
      <Route path="/interview-access/:role_token" element={<InterviewAccessPage />} />
      <Route path="/verify-otp" element={<VerifyOtp />} />
      <Route path="/test-rls" element={<TestRLS />} />
      <Route path="/demo" element={<Demo />} /> {/* ✅ NEW */}
    </Routes>
  );
}

export default App;
