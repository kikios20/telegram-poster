import { useState } from 'react'
import { motion } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import { Logo, LogoText } from '../components/Logo'
import { useAuthStore } from '../hooks/useStore'
import { api } from '../hooks/useStore'
import { Mail, Lock, Key, ArrowRight, AlertCircle, User } from 'lucide-react'

export function Login() {
  const navigate = useNavigate()
  const { login, loginWithApiKey } = useAuthStore()
  const [mode, setMode] = useState('email') // 'email' or 'apikey'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleEmailLogin = async (e) => {
    if (e && e.preventDefault) e.preventDefault()
    setError('')
    setIsLoading(true)
    
    try {
      await login(email, password)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Ошибка входа')
      setIsLoading(false)
    }
  }

  const handleApiKeyLogin = async (e) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)
    
    try {
      await loginWithApiKey(apiKey)
      // Force navigation after state update
      setTimeout(() => navigate('/dashboard'), 100)
    } catch (err) {
      setError(err.response?.data?.detail || 'Неверный ключ API')
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-animated bg-grid flex items-center justify-center p-4">
      {/* Background effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <motion.div
          className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(57,255,20,0.1) 0%, transparent 70%)'
          }}
          animate={{
            x: [0, 50, 0],
            y: [0, 30, 0],
          }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(0,255,136,0.08) 0%, transparent 70%)'
          }}
          animate={{
            x: [0, -40, 0],
            y: [0, -20, 0],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative z-10"
      >
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <LogoText />
        </div>

        {/* Card */}
        <div className="glass-strong rounded-2xl p-8">
          {/* Mode tabs */}
          <div className="flex gap-2 p-1 bg-black/30 rounded-xl mb-6">
            <button
              onClick={() => { setMode('email'); setError('') }}
              className={`
                flex-1 py-2.5 px-4 rounded-lg font-medium transition-all duration-200
                ${mode === 'email' 
                  ? 'bg-kikio-glow text-black shadow-[0_0_20px_rgba(57,255,20,0.3)]' 
                  : 'text-gray-400 hover:text-white'
                }
              `}
            >
              <div className="flex items-center justify-center gap-2">
                <Mail size={16} />
                <span>Почта</span>
              </div>
            </button>
            <button
              onClick={() => { setMode('apikey'); setError('') }}
              className={`
                flex-1 py-2.5 px-4 rounded-lg font-medium transition-all duration-200
                ${mode === 'apikey' 
                  ? 'bg-kikio-glow text-black shadow-[0_0_20px_rgba(57,255,20,0.3)]' 
                  : 'text-gray-400 hover:text-white'
                }
              `}
            >
              <div className="flex items-center justify-center gap-2">
                <Key size={16} />
                <span>API Ключ</span>
              </div>
            </button>
          </div>

          {/* Error message */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400"
            >
              <AlertCircle size={18} />
              <span>{error}</span>
            </motion.div>
          )}

          {/* Email form */}
          {mode === 'email' && (
            <motion.form
              key="email-form"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              onSubmit={(e) => { e.preventDefault(); handleEmailLogin(e); }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">
                  Email
                </label>
                <div className="relative">
                  <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                    className="w-full pl-10 pr-4 py-3 rounded-lg bg-black/50 border border-white/10 focus:border-kikio-glow transition-colors"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">
                  Пароль
                </label>
                <div className="relative">
                  <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full pl-10 pr-4 py-3 rounded-lg bg-black/50 border border-white/10 focus:border-kikio-glow transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="btn btn-primary w-full flex items-center justify-center gap-2 py-3.5 mt-6"
              >
                {isLoading ? (
                  <div className="spinner" />
                ) : (
                  <>
                    <span>Войти</span>
                    <ArrowRight size={18} />
                  </>
                )}
              </button>

              <p className="text-center text-gray-400 text-sm mt-4">
                Нет аккаунта?{' '}
                <Link to="/register" className="text-kikio-glow hover:underline">
                  Зарегистрироваться
                </Link>
              </p>
            </motion.form>
          )}

          {/* API Key form */}
          {mode === 'apikey' && (
            <motion.form
              key="apikey-form"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              onSubmit={handleApiKeyLogin}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">
                  Ключ доступа
                </label>
                <div className="relative">
                  <Key size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    type="text"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    required
                    className="w-full pl-10 pr-4 py-3 rounded-lg bg-black/50 border border-white/10 focus:border-kikio-glow transition-colors font-mono text-sm"
                  />
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  Введите ключ доступа, выданный администратором
                </p>
              </div>

              <motion.button
                type="submit"
                disabled={isLoading}
                className="btn btn-primary w-full flex items-center justify-center gap-2 py-3.5 mt-6"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {isLoading ? (
                  <div className="spinner" />
                ) : (
                  <>
                    <span>Войти</span>
                    <ArrowRight size={18} />
                  </>
                )}
              </motion.button>
            </motion.form>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-gray-500 text-sm mt-6">
          Kikio Telegram Poster © 2026
        </p>
      </motion.div>
    </div>
  )
}
