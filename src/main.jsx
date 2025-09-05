import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import SignIn from './pages/SignIn.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import ClientDashboard from './pages/ClientDashboard.jsx'
import AcceptInvite from './pages/AcceptInvite.jsx'
import Invite from './pages/Invite.jsx'
import './styles/alphaTheme.css';


const router = createBrowserRouter([
  { path: '/signin', element: <SignIn /> },
  { path: '/accept-invite', element: <AcceptInvite /> },
  { path: '/invite', element: <ProtectedRoute><Invite /></ProtectedRoute> },
  { path: '/', element: <ProtectedRoute><ClientDashboard /></ProtectedRoute> }
])

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
)
