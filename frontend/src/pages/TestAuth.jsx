import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore, api } from '../hooks/useStore'

export function TestAuth() {
  const navigate = useNavigate()
  const { token, isAuthenticated, login } = useAuthStore()
  const [status, setStatus] = useState('Initializing...')
  const [local, setLocal] = useState('')
  
  useEffect(() => {
    setLocal(localStorage.getItem('kikio-auth') || 'empty')
    
    // Wait for Zustand to hydrate
    const checkHydrated = setInterval(() => {
      const hydrated = useAuthStore.persist.hasHydrated()
      setStatus(`Hydrated: ${hydrated}, token: ${useAuthStore.getState().token}, auth: ${useAuthStore.getState().isAuthenticated}`)
      setLocal(localStorage.getItem('kikio-auth') || 'empty')
      
      if (hydrated && !useAuthStore.getState().token) {
        setStatus('Hydrated, starting login...')
        clearInterval(checkHydrated)
        
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
            setStatus('Login response: ' + JSON.stringify(data))
            if (data.access_token) {
              useAuthStore.setState({ 
                token: data.access_token, 
                isAuthenticated: true, 
                user: null 
              })
              setLocal(localStorage.getItem('kikio-auth') || 'still empty!')
              setTimeout(() => navigate('/dashboard'), 500)
            }
          })
          .catch(err => {
            setStatus('Error: ' + err.message)
          })
      }
    }, 100)
    
    return () => clearInterval(checkHydrated)
  }, [])
  
  return (
    <div style={{ padding: '50px', textAlign: 'center' }}>
      <h1>Test Auth Page</h1>
      <p>Status: {status}</p>
      <p>localStorage: {local}</p>
      <br />
      <button onClick={() => navigate('/dashboard')} style={{ padding: '10px 20px', fontSize: '16px' }}>
        Go to Dashboard
      </button>
    </div>
  )
}
