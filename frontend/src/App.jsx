import { Routes, Route, Navigate, useSearchParams, useNavigate } from 'react-router-dom'
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
  const navigate = useNavigate()
  
  useEffect(() => {
    const email = searchParams.get('email')
    const password = searchParams.get('password')
    console.log('AutoLogin:', email, password)
    if (email && password) {
      fetch('https://telegram-poster-api.onrender.com/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `username=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`,
      })
        .then(r => {
          console.log('Response status:', r.status)
          return r.json()
        })
        .then(data => {
          console.log('Data:', data)
          if (data.access_token) {
            useAuthStore.setState({ 
              token: data.access_token, 
              isAuthenticated: true, 
              user: null 
            })
            console.log('Navigating to dashboard')
            navigate('/dashboard')
          } else {
            console.log('No token, navigating to login')
            navigate('/login')
          }
        })
        .catch(err => {
          console.error('Error:', err)
          navigate('/login')
        })
    } else {
      console.log('No email/password, navigating to login')
      navigate('/login')
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
