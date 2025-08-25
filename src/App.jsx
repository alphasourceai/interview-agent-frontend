import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ClientProvider } from "./lib/clientContext";
import NavBar from "./components/NavBar";
import RequireAuth from "./components/RequireAuth";
import SignIn from "./pages/SignIn";
import AuthCallback from "./pages/AuthCallback";
import Roles from "./pages/Roles";
import RoleNew from "./pages/RoleNew";
import Candidates from "./pages/Candidates";
import Account from "./pages/Account";
import ClientDashboard from "./pages/ClientDashboard.jsx";

export default function App() {
  return (
    <ClientProvider>
      <BrowserRouter>
        <NavBar />
        <Routes>
          <Route path="/signin" element={<SignIn />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route element={<RequireAuth />}>
            <Route path="/" element={<Navigate to="/roles" replace />} />
            <Route path="/roles" element={<Roles />} />
            <Route path="/roles/new" element={<RoleNew />} />
            <Route path="/candidates" element={<Candidates />} />
            <Route path="/account" element={<Account />} />
            <Route path="/dashboard" element={<Candidates />} />
            <Route path="/client-dashboard" element={<ClientDashboard />} />
          </Route>
          <Route path="*" element={<Navigate to="/roles" replace />} />
        </Routes>
      </BrowserRouter>
    </ClientProvider>
  );
}
