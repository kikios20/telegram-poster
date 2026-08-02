import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore, api } from '../hooks/useStore'

export function TestAuth() {
  const navigate = useNavigate()
  const { token, isAuthenticated, login } = useAuthStore()
  
  // Auto login on mount if not authenticated
  useEffect(() => {
    if (!isAuthenticated && !token) {
      console.log('Auto login...')
      
      api.post('/auth/login', 
        `username=${encodeURIComponent('testagent999@test.com')}&password=${encodeURIComponent('testpass456')}`,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      )
        .then(r => r.data)
        .then(data => {
          console.log('Login response:', data)
          if (data.access_token) {
            useAuthStore.setState({ 
              token: data.access_token, 
              isAuthenticated: true, 
              user: null 
            })
            console.log('Store updated, checking localStorage:', localStorage.getItem('kikio-auth'))
            setTimeout(() => {
              console.log('After timeout, localStorage:', localStorage.getItem('kikio-auth'))
              navigate('/dashboard')
            }, 500)
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
