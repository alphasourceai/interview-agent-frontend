// src/App.jsx
import { BrowserRouter, Routes, Route, Link, Navigate } from "react-router-dom";

// Protected app pages
import Roles from "./pages/Roles.jsx";
import Candidates from "./pages/Candidates.jsx";
import Account from "./pages/Account.jsx";
import ClientDashboard from "./pages/ClientDashboard.jsx"; // legacy page, kept

// Public pages already in your repo
import SignIn from "./pages/SignIn.jsx";
import AcceptInvite from "./pages/AcceptInvite.jsx";
import InterviewAccessPage from "./pages/InterviewAccessPage.jsx";
import VerifyOtp from "./pages/VerifyOtp.jsx";

// Auth utilities
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import SignOutButton from "./components/SignOutButton.jsx";

function Shell({ children }) {
  return (
    <div>
      <nav className="border-b">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex gap-4">
            <Link to="/roles" className="hover:underline">Roles</Link>
            <Link to="/candidates" className="hover:underline">Candidates</Link>
            <Link to="/account" className="hover:underline">Account</Link>
          </div>
          <SignOutButton />
        </div>
      </nav>
      <main className="max-w-6xl mx-auto px-4 py-4">
        {children}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes (no auth required) */}
        <Route path="/signin" element={<Shell><SignIn /></Shell>} />
        <Route path="/accept-invite" element={<Shell><AcceptInvite /></Shell>} />
        <Route path="/interview-access/:role_token" element={<Shell><InterviewAccessPage /></Shell>} />
        <Route path="/verify-otp" element={<Shell><VerifyOtp /></Shell>} />

        {/* Protected routes (require session) */}
        <Route
          path="/"
          element={
            <Shell>
              <ProtectedRoute>
                <Navigate to="/candidates" replace />
              </ProtectedRoute>
            </Shell>
          }
        />
        <Route
          path="/roles"
          element={
            <Shell>
              <ProtectedRoute>
                <Roles />
              </ProtectedRoute>
            </Shell>
          }
        />
        <Route
          path="/candidates"
          element={
            <Shell>
              <ProtectedRoute>
                <Candidates />
              </ProtectedRoute>
            </Shell>
          }
        />
        <Route
          path="/account"
          element={
            <Shell>
              <ProtectedRoute>
                <Account />
              </ProtectedRoute>
            </Shell>
          }
        />

        {/* Back-compat/legacy mappings */}
        <Route
          path="/dashboard"
          element={
            <Shell>
              <ProtectedRoute>
                <Candidates />
              </ProtectedRoute>
            </Shell>
          }
        />
        <Route
          path="/client-dashboard"
          element={
            <Shell>
              <ProtectedRoute>
                <ClientDashboard />
              </ProtectedRoute>
            </Shell>
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Shell><div>Not found</div></Shell>} />
      </Routes>
    </BrowserRouter>
  );
}
