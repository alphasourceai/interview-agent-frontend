import { BrowserRouter, Routes, Route, Link, Navigate } from "react-router-dom";

// context/provider
import { ClientProvider } from "./lib/clientContext.jsx";

// public pages
import SignIn from "./pages/SignIn.jsx";
import AuthCallback from "./pages/AuthCallback.jsx";
import AcceptInvite from "./pages/AcceptInvite.jsx";
import InterviewAccessPage from "./pages/InterviewAccessPage.jsx";
import VerifyOtp from "./pages/VerifyOtp.jsx";

// protected pages
import Roles from "./pages/Roles.jsx";
import Candidates from "./pages/Candidates.jsx";
import Account from "./pages/Account.jsx";
import ClientDashboard from "./pages/ClientDashboard.jsx"; // legacy

// auth helpers
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import SignOutButton from "./components/SignOutButton.jsx";

// ---- simple inline styles (no Tailwind) ----
const navStyle = {
  borderBottom: "1px solid #e5e7eb",
  background: "#fff",
};
const navInnerStyle = {
  maxWidth: 1100,
  margin: "0 auto",
  padding: "12px 16px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 16,
};
const navLinksStyle = { display: "flex", gap: 16, alignItems: "center" };
const mainStyle = { maxWidth: 1100, margin: "0 auto", padding: "16px" };

function AppShell({ children }) {
  return (
    <div>
      <nav style={navStyle}>
        <div style={navInnerStyle}>
          <div style={navLinksStyle}>
            <Link to="/roles">Roles</Link>
            <Link to="/candidates">Candidates</Link>
            <Link to="/account">Account</Link>
          </div>
          <SignOutButton />
        </div>
      </nav>
      <main style={mainStyle}>{children}</main>
    </div>
  );
}

function PublicShell({ children }) {
  return <main style={mainStyle}>{children}</main>;
}

export default function App() {
  return (
    <ClientProvider>
      <BrowserRouter>
        <Routes>
          {/* public routes (no nav, no auth) */}
          <Route path="/signin" element={<PublicShell><SignIn /></PublicShell>} />
          <Route path="/auth/callback" element={<PublicShell><AuthCallback /></PublicShell>} />
          <Route path="/accept-invite" element={<PublicShell><AcceptInvite /></PublicShell>} />
          <Route path="/interview-access/:role_token" element={<PublicShell><InterviewAccessPage /></PublicShell>} />
          <Route path="/verify-otp" element={<PublicShell><VerifyOtp /></PublicShell>} />

          {/* protected routes (nav + auth) */}
          <Route
            path="/"
            element={
              <AppShell>
                <ProtectedRoute>
                  <Navigate to="/candidates" replace />
                </ProtectedRoute>
              </AppShell>
            }
          />
          <Route
            path="/roles"
            element={
              <AppShell>
                <ProtectedRoute>
                  <Roles />
                </ProtectedRoute>
              </AppShell>
            }
          />
          <Route
            path="/candidates"
            element={
              <AppShell>
                <ProtectedRoute>
                  <Candidates />
                </ProtectedRoute>
              </AppShell>
            }
          />
          <Route
            path="/account"
            element={
              <AppShell>
                <ProtectedRoute>
                  <Account />
                </ProtectedRoute>
              </AppShell>
            }
          />

          {/* legacy back-compat */}
          <Route
            path="/dashboard"
            element={
              <AppShell>
                <ProtectedRoute>
                  <Candidates />
                </ProtectedRoute>
              </AppShell>
            }
          />
          <Route
            path="/client-dashboard"
            element={
              <AppShell>
                <ProtectedRoute>
                  <ClientDashboard />
                </ProtectedRoute>
              </AppShell>
            }
          />

          {/* 404 */}
          <Route path="*" element={<PublicShell><div>Not found</div></PublicShell>} />
        </Routes>
      </BrowserRouter>
    </ClientProvider>
  );
}
