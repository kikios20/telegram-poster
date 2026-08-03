import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore, api } from '../hooks/useStore'

export function TestAuth() {
  const navigate = useNavigate()
  const [debugInfo, setDebugInfo] = useState('')

  const handleLogin = async () => {
    let log = ''
    try {
      log += '1. CALLING API...\n\n'
      const response = await api.post('/auth/login',
        `username=${encodeURIComponent('testnew@test.com')}&password=${encodeURIComponent('testpass123')}`,
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      )
      log += '2. RAW RESPONSE: ' + JSON.stringify(response.data) + '\n\n'
      
      const { access_token } = response.data
      log += '3. TOKEN: ' + access_token + '\n\n'
      
      useAuthStore.setState({ token: access_token, isAuthenticated: true })
      log += '4. STORE AFTER SET: ' + JSON.stringify(useAuthStore.getState()) + '\n\n'
      
      log += '5. LOCALSTORAGE: ' + localStorage.getItem('kikio-auth') + '\n\n'
      
      log += '6. NAVIGATING TO /dashboard'
      navigate('/dashboard')
    } catch (err) {
      log += 'ERROR: ' + err.message + '\n' + JSON.stringify(err.response?.data)
    }
    setDebugInfo(log)
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace', fontSize: '14px' }}>
      <h1>Test Auth</h1>
      <button onClick={handleLogin} style={{ padding: '10px 20px', fontSize: '16px', marginBottom: '20px' }}>
        Run Login Test
      </button>
      <pre style={{ 
        background: '#1a1a1a', 
        color: '#0f0', 
        padding: '20px', 
        borderRadius: '8px',
        whiteSpace: 'pre-wrap',
        textAlign: 'left'
      }}>{debugInfo || 'Click button to run test...'}</pre>
    </div>
  )
}
