import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import SignIn from './pages/SignIn.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import ClientDashboard from './pages/ClientDashboard.jsx'

const router = createBrowserRouter([
  { path: '/signin', element: <SignIn /> },
  { path: '/', element: <ProtectedRoute><ClientDashboard /></ProtectedRoute> }
])

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
)
