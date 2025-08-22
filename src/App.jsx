// src/App.jsx
import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom'
import Roles from './pages/Roles'
import Candidates from './pages/Candidates'
import Account from './pages/Account'
// If you have a signin page etc., import them here.

function Shell({ children }) {
  return (
    <div>
      <nav className="border-b">
        <div className="max-w-6xl mx-auto px-4 py-3 flex gap-4">
          <Link to="/roles" className="hover:underline">Roles</Link>
          <Link to="/candidates" className="hover:underline">Candidates</Link>
          <Link to="/account" className="hover:underline">Account</Link>
        </div>
      </nav>
      <main>{children}</main>
    </div>
  )
}

// If you already have a ProtectedRoute component, you can wrap Routes with it.
// For simplicity here we assume your auth gate happens higher up.
export default function App() {
  return (
    <BrowserRouter>
      <Shell>
        <Routes>
          <Route path="/" element={<Navigate to="/candidates" replace />} />
          <Route path="/roles" element={<Roles />} />
          <Route path="/candidates" element={<Candidates />} />
          <Route path="/account" element={<Account />} />
          {/* Add your existing auth routes here, e.g., /sign-in, /accept-invite */}
          <Route path="*" element={<div className="p-6">Not found</div>} />
        </Routes>
      </Shell>
    </BrowserRouter>
  )
}
