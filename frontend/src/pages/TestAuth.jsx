import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../hooks/useStore'

const API_URL = 'https://telegram-poster-api.onrender.com/api'

export function TestAuth() {
  const navigate = useNavigate()
  const { token, isAuthenticated, login } = useAuthStore()
  
  // Auto login on mount if not authenticated
  useEffect(() => {
    if (!isAuthenticated && !token) {
      console.log('Auto login...')
      fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'username=testagent999@test.com&password=testpass456',
      })
        .then(r => r.json())
        .then(data => {
          console.log('Login response:', data)
          if (data.access_token) {
            useAuthStore.setState({ 
              token: data.access_token, 
              isAuthenticated: true, 
              user: null 
            })
            navigate('/dashboard')
          }
        })
        .catch(err => {
          console.error('Login error:', err)
        })
    }
  }, [])
  
  const handleLogin = async () => {
    try {
      await login('testagent999@test.com', 'testpass456')
      console.log('Login success, navigating to dashboard...')
      navigate('/dashboard')
    } catch (e) {
      console.error('Login failed:', e)
      alert('Login failed: ' + e.message)
    }
  }
  
  return (
    <div style={{ padding: '50px', textAlign: 'center' }}>
      <h1>Test Auth Page</h1>
      <p>Token: {token ? '✓ exists' : '✗ missing'}</p>
      <p>isAuthenticated: {String(isAuthenticated)}</p>
      <p>localStorage: {localStorage.getItem('kikio-auth')}</p>
      <button id="login-btn" onClick={handleLogin} style={{ padding: '10px 20px', fontSize: '16px' }}>
        Login via Zustand
      </button>
      <br /><br />
      <button onClick={() => navigate('/dashboard')} style={{ padding: '10px 20px', fontSize: '16px' }}>
        Go to Dashboard
      </button>
    </div>
  )
}
