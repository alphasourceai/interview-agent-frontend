// src/main.jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'

import './styles/alphaTheme.css'

// Public pages
import SignIn from './pages/SignIn.jsx'
import VerifyOtp from './pages/VerifyOtp.jsx'
import InterviewAccessPage from './pages/InterviewAccessPage.jsx'
import Admin from './pages/Admin.jsx'


// Legacy single-page dashboard + role views
import ClientDashboard from './pages/ClientDashboard.jsx'
import RoleCreator from './pages/RoleCreator.jsx'
import RoleReports from './pages/RoleReports.jsx'
import RoleCandidates from './pages/RoleCandidates.jsx'

// Auth guard
import ProtectedRoute from './components/ProtectedRoute.jsx'

const router = createBrowserRouter([
  // default → dashboard (single page)
  { path: '/', element: <ProtectedRoute><ClientDashboard /></ProtectedRoute> },

  // public
  { path: '/signin', element: <SignIn /> },
  { path: '/verify-otp', element: <VerifyOtp /> },
  { path: '/interview-access', element: <InterviewAccessPage /> },
  { path: '/interview-access/:role_token', element: <InterviewAccessPage /> },
  { path: '/admin', element: <Admin /> },

  // legacy single-page + role views
  { path: '/dashboard', element: <ProtectedRoute><ClientDashboard /></ProtectedRoute> },
  { path: '/create-role', element: <ProtectedRoute><RoleCreator /></ProtectedRoute> },
  { path: '/reports/:roleId', element: <ProtectedRoute><RoleReports /></ProtectedRoute> },
  { path: '/candidates/:roleId', element: <ProtectedRoute><RoleCandidates /></ProtectedRoute> },

  // catch-all → dashboard
  { path: '*', element: <Navigate to="/dashboard" replace /> },
])

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
)
