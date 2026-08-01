import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTelegramStore, useAuthStore } from '../hooks/useStore'
import { 
  Settings, 
  Send, 
  LogOut, 
  CheckCircle, 
  XCircle, 
  Loader2,
  AlertTriangle,
  Smartphone,
  Key,
  Shield,
  Info
} from 'lucide-react'

export function SettingsPage() {
  const { user } = useAuthStore()
  const { 
    status, 
    fetchStatus, 
    connect, 
    verifyCode, 
    verify2FA,
    logout,
    error,
    isConnecting 
  } = useTelegramStore()
  
  const [step, setStep] = useState('initial') // 'initial', 'credentials', 'phone', 'code', '2fa'
  const [apiId, setApiId] = useState('')
  const [apiHash, setApiHash] = useState('')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [sessionId, setSessionId] = useState('')

  useState(() => {
    fetchStatus()
  }, [])

  const handleCredentialsSubmit = async (e) => {
    e.preventDefault()
    try {
      const result = await connect(apiId, apiHash, phone)
      setSessionId(result.session_id)
      setStep('code')
    } catch (err) {
      console.error('Connection failed:', err)
    }
  }

  const handleCodeSubmit = async (e) => {
    e.preventDefault()
    try {
      const result = await verifyCode(sessionId, code)
      if (result.status === '2fa_required') {
        setStep('2fa')
      } else {
        await fetchStatus()
        setStep('connected')
      }
    } catch (err) {
      console.error('Code verification failed:', err)
    }
  }

  const handle2FASubmit = async (e) => {
    e.preventDefault()
    try {
      await verify2FA(sessionId, password)
      await fetchStatus()
      setStep('connected')
    } catch (err) {
      console.error('2FA verification failed:', err)
    }
  }

  const handleLogout = async () => {
    await logout()
    setStep('initial')
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Настройки</h1>
        <p className="text-gray-400 mt-1">
          Подключение Telegram аккаунта
        </p>
      </div>

      {/* Current status */}
      <div className="card p-6">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
            status.connected 
              ? 'bg-green-500/20' 
              : 'bg-gray-500/20'
          }`}>
            {status.connected ? (
              <CheckCircle size={24} className="text-green-400" />
            ) : (
              <Send size={24} className="text-gray-400" />
            )}
          </div>
          
          <div className="flex-1">
            <h3 className="font-semibold">
              {status.connected 
                ? 'Telegram подключен' 
                : 'Telegram не подключен'
              }
            </h3>
            {status.connected ? (
              <p className="text-sm text-gray-400">
                @{status.username || status.phone}
              </p>
            ) : (
              <p className="text-sm text-gray-500">
                Подключите аккаунт для рассылки сообщений
              </p>
            )}
          </div>

          {status.connected && (
            <button
              onClick={handleLogout}
              className="btn btn-secondary text-sm"
            >
              <LogOut size={16} />
              <span className="ml-2">Отключить</span>
            </button>
          )}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400"
        >
          <AlertTriangle size={20} />
          <span>{error}</span>
        </motion.div>
      )}

      {/* Connection steps */}
      {!status.connected && (
        <div className="card p-6">
          <AnimatePresence mode="wait">
            
            {/* Step: Initial */}
            {step === 'initial' && (
              <motion.div
                key="initial"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-6"
              >
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-kikio-glow/10 flex items-center justify-center">
                    <Smartphone size={32} className="text-kikio-glow" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Подключение Telegram</h3>
                  <p className="text-gray-400 text-sm">
                    Для работы необходимы API credentials от my.telegram.org
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="flex items-start gap-3 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <Info size={18} className="text-blue-400 mt-0.5" />
                    <div className="text-sm text-gray-300">
                      <p className="font-medium text-blue-400 mb-1">Как получить API credentials:</p>
                      <ol className="list-decimal list-inside space-y-1 text-gray-400">
                        <li>Зайдите на <a href="https://my.telegram.org" target="_blank" rel="noopener" className="text-blue-400 hover:underline">my.telegram.org</a></li>
                        <li>Авторизуйтесь через свой аккаунт</li>
                        <li>Перейдите в "API development tools"</li>
                        <li>Создайте приложение и получите api_id и api_hash</li>
                      </ol>
                    </div>
                  </div>

                  <button
                    onClick={() => setStep('credentials')}
                    className="btn btn-primary w-full"
                  >
                    Продолжить
                  </button>
                </div>
              </motion.div>
            )}

            {/* Step: Credentials */}
            {step === 'credentials' && (
              <motion.form
                key="credentials"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                onSubmit={handleCredentialsSubmit}
                className="space-y-6"
              >
                <div className="flex items-center gap-3 mb-4">
                  <button
                    type="button"
                    onClick={() => setStep('initial')}
                    className="text-gray-400 hover:text-white"
                  >
                    ← Назад
                  </button>
                  <h3 className="text-xl font-semibold">Введите API credentials</h3>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1.5">
                      <Key size={14} className="inline mr-1" />
                      API ID
                    </label>
                    <input
                      type="number"
                      value={apiId}
                      onChange={(e) => setApiId(e.target.value)}
                      placeholder="1234567"
                      required
                      className="w-full px-4 py-3 rounded-lg bg-black/50 border border-white/10 focus:border-kikio-glow"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1.5">
                      <Key size={14} className="inline mr-1" />
                      API Hash
                    </label>
                    <input
                      type="text"
                      value={apiHash}
                      onChange={(e) => setApiHash(e.target.value)}
                      placeholder="0123456789abcdef0123456789abcdef"
                      required
                      className="w-full px-4 py-3 rounded-lg bg-black/50 border border-white/10 focus:border-kikio-glow font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1.5">
                      <Smartphone size={14} className="inline mr-1" />
                      Номер телефона
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+79001234567"
                      required
                      className="w-full px-4 py-3 rounded-lg bg-black/50 border border-white/10 focus:border-kikio-glow"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Введите номер в международном формате
                    </p>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isConnecting}
                  className="btn btn-primary w-full"
                >
                  {isConnecting ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : (
                    'Подключить'
                  )}
                </button>
              </motion.form>
            )}

            {/* Step: Code verification */}
            {step === 'code' && (
              <motion.form
                key="code"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                onSubmit={handleCodeSubmit}
                className="space-y-6"
              >
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-kikio-glow/10 flex items-center justify-center">
                    <Shield size={32} className="text-kikio-glow" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Подтверждение</h3>
                  <p className="text-gray-400 text-sm">
                    Введите код, отправленный на номер {phone}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1.5">
                    Код из Telegram
                  </label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="12345"
                    maxLength={5}
                    required
                    className="w-full px-4 py-3 rounded-lg bg-black/50 border border-white/10 focus:border-kikio-glow text-center text-2xl tracking-widest font-mono"
                    autoFocus
                  />
                </div>

                <button
                  type="submit"
                  disabled={isConnecting || code.length < 5}
                  className="btn btn-primary w-full"
                >
                  {isConnecting ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : (
                    'Подтвердить'
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setStep('credentials')}
                  className="w-full text-sm text-gray-500 hover:text-white"
                >
                  Изменить номер телефона
                </button>
              </motion.form>
            )}

            {/* Step: 2FA */}
            {step === '2fa' && (
              <motion.form
                key="2fa"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                onSubmit={handle2FASubmit}
                className="space-y-6"
              >
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-yellow-500/10 flex items-center justify-center">
                    <Shield size={32} className="text-yellow-400" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Двухфакторная авторизация</h3>
                  <p className="text-gray-400 text-sm">
                    Введите пароль от аккаунта Telegram
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1.5">
                    Пароль
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full px-4 py-3 rounded-lg bg-black/50 border border-white/10 focus:border-kikio-glow"
                    autoFocus
                  />
                </div>

                <button
                  type="submit"
                  disabled={isConnecting}
                  className="btn btn-primary w-full"
                >
                  {isConnecting ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : (
                    'Подтвердить'
                  )}
                </button>
              </motion.form>
            )}

          </AnimatePresence>
        </div>
      )}

      {/* Security info */}
      <div className="card p-6">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Shield size={18} className="text-kikio-glow" />
          Безопасность
        </h3>
        <div className="space-y-3 text-sm text-gray-400">
          <p>
            Ваш аккаунт Telegram защищён и хранится в зашифрованном виде на сервере.
          </p>
          <p>
            Мы не передаём данные третьим лицам и не используем их в других целях.
          </p>
          <p>
            Вы можете отключить аккаунт в любой момент.
          </p>
        </div>
      </div>
    </div>
  )
}
