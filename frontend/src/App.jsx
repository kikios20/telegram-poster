import { Routes, Route, Navigate, useSearchParams } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuthStore } from './hooks/useStore'
import { Layout } from './components/Layout'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { Dashboard } from './pages/Dashboard'
import { HistoryPage } from './pages/History'
import { SettingsPage } from './pages/Settings'
import { TestAuth } from './pages/TestAuth'

function ProtectedRoute({ children }) {
  const { isAuthenticated, token } = useAuthStore()
  const hasHydrated = useAuthStore.persist.hasHydrated()

  if (!hasHydrated) {
    return <div className="min-h-screen flex items-center justify-center">
      <div className="spinner" />
    </div>
  }

  if (!isAuthenticated && !token) {
    return <Navigate to="/login" replace />
  }

  return children
}

// Route for automatic login via URL params (for testing)
function AutoLogin() {
  const [searchParams] = useSearchParams()
  const { login } = useAuthStore()
  
  useEffect(() => {
    const email = searchParams.get('email')
    const password = searchParams.get('password')
    if (email && password) {
      login(email, password).then(() => {
        window.location.href = '/dashboard'
      })
    }
  }, [])
  
  return <div className="min-h-screen flex items-center justify-center">
    <div className="spinner" />
    <span className="ml-3">Вход...</span>
  </div>
}

// Temporary test route - no protection
function TestRoute({ children }) {
  return children
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/autologin" element={<AutoLogin />} />
      <Route path="/test-auth" element={<TestRoute><TestAuth /></TestRoute>} />
      
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default App
