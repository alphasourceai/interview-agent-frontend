import { Navigate } from 'react-router-dom'
import { useSession } from '../hooks/useSession'
export default function ProtectedRoute({ children }) {
  const { session, loading } = useSession()
  if (loading) return null
  if (!session) return <Navigate to="/signin" replace />
  return children
}
