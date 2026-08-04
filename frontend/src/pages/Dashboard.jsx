import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useTelegramStore, useCampaignStore, useAuthStore } from '../hooks/useStore'
import { 
  Send, 
  Plus, 
  Trash2, 
  Play, 
  Pause, 
  Square, 
  CheckCircle,
  XCircle,
  AlertTriangle,
  MessageSquare,
  Users,
  Clock,
  ChevronDown,
  Loader2,
  RefreshCw
} from 'lucide-react'

export function Dashboard() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { status, fetchStatus } = useTelegramStore()
  const { createCampaign, startCampaign } = useCampaignStore()
  
  const [mode, setMode] = useState('single') // 'single' or 'rotating'
  const [messages, setMessages] = useState([''])
  const [chatLinks, setChatLinks] = useState([''])
  const [delaySeconds, setDelaySeconds] = useState(10)
  const [sendMode, setSendMode] = useState('sequential')
  const [campaignName, setCampaignName] = useState('')
  const [validatedChats, setValidatedChats] = useState([])
  const [isValidating, setIsValidating] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [showLimits, setShowLimits] = useState(false)
  const [riskAccepted, setRiskAccepted] = useState(false)
  const [jitterSeconds, setJitterSeconds] = useState(2)
  const [scheduledAt, setScheduledAt] = useState('')
  const [endsAt, setEndsAt] = useState('')

  const tier = user?.tier || 'free'
  const jitterMax = tier === 'vip' ? 30 : tier === 'basic' ? 10 : 2
  const jitterFixed = tier === 'free'
  const maxDelaySeconds = tier === 'free' ? 60 : 1800  // Free: 60, Basic/VIP: 1800

  useEffect(() => {
    fetchStatus()
  }, [])

  // Redirect if not connected
  if (!status.connected) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-md"
        >
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-kikio-glow/10 flex items-center justify-center">
            <XCircle size={40} className="text-kikio-glow" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Telegram не подключен</h2>
          <p className="text-gray-400 mb-6">
            Для создания рассылки необходимо подключить Telegram аккаунт
          </p>
          <button
            onClick={() => navigate('/settings')}
            className="btn btn-primary"
          >
            Подключить Telegram
          </button>
        </motion.div>
      </div>
    )
  }

  const addMessage = () => {
    setMessages([...messages, ''])
  }

  const removeMessage = (index) => {
    if (messages.length > 1) {
      setMessages(messages.filter((_, i) => i !== index))
    }
  }

  const updateMessage = (index, value) => {
    const newMessages = [...messages]
    newMessages[index] = value
    setMessages(newMessages)
  }

  const addChat = () => {
    setChatLinks([...chatLinks, ''])
  }

  const removeChat = (index) => {
    if (chatLinks.length > 1) {
      setChatLinks(chatLinks.filter((_, i) => i !== index))
    }
  }

  const updateChat = (index, value) => {
    const newChats = [...chatLinks]
    newChats[index] = value
    setChatLinks(newChats)
  }

  const handleValidateChats = async () => {
    setIsValidating(true)
    const validLinks = chatLinks.filter(l => l.trim())
    
    // Validate each chat via API
    const validationResults = await Promise.all(
      validLinks.map(async (link) => {
        try {
          const result = await useTelegramStore.getState().validateChat(link)
          return {
            link,
            valid: result.valid,
            title: result.title || link.replace('https://t.me/', '').replace('@', ''),
            error: result.error
          }
        } catch (err) {
          return {
            link,
            valid: false,
            title: link.replace('https://t.me/', '').replace('@', ''),
            error: 'Ошибка проверки'
          }
        }
      })
    )
    
    setValidatedChats(validationResults)
    setIsValidating(false)
  }

  const handleCreateAndStart = async () => {
    if (!campaignName.trim()) {
      alert('Введите название рассылки')
      return
    }
    
    const validMessages = messages.filter(m => m.trim())
    const validLinks = validatedChats.filter(c => c.valid).map(c => c.link)
    
    if (validMessages.length === 0) {
      alert('Введите хотя бы одно сообщение')
      return
    }
    
    if (validLinks.length === 0) {
      alert('Добавьте хотя бы один чат')
      return
    }
    
    setIsCreating(true)
    
    try {
      const campaignData = {
        name: campaignName,
        mode: mode,
        messages: validMessages,
        chat_links: validLinks,
        delay_seconds: delaySeconds,
        jitter_seconds: jitterFixed ? 2 : jitterSeconds,
        send_mode: sendMode
      }
      
      // Add schedule fields if provided
      if (scheduledAt) {
        campaignData.scheduled_at = new Date(scheduledAt).toISOString()
      }
      if (endsAt) {
        campaignData.ends_at = new Date(endsAt).toISOString()
      }
      
      const campaign = await createCampaign(campaignData)
      
      // Only start immediately if no scheduled_at
      if (!scheduledAt) {
        await startCampaign(campaign.id)
      }
      navigate('/history')
    } catch (error) {
      console.error('Failed to create campaign:', error)
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Создание рассылки</h1>
          <p className="text-gray-400 mt-1">
            Отправляйте сообщения в Telegram чаты
          </p>
        </div>
        
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/30">
          <span className="status-dot status-success" />
          <span className="text-sm text-green-400">
            @{status.username || status.phone}
          </span>
        </div>
      </div>

      {/* Tier limits */}
      <div className="card p-4 bg-blue-500/5 border border-blue-500/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 rounded text-xs font-medium bg-blue-500/20 text-blue-400">
              {tier.toUpperCase()}
            </span>
            <span className="text-sm text-gray-400">
              Доступно: <span className="text-white font-medium">
                {tier === 'free' ? '3 чата, 10 сообщений' : tier === 'basic' ? '15 чатов, 300 сообщений' : '30 чатов, 1000 сообщений'}
              </span> в день
            </span>
          </div>
          <button
            onClick={() => setShowLimits(!showLimits)}
            className="text-xs text-blue-400 hover:text-blue-300"
          >
            {showLimits ? 'Скрыть' : 'Подробнее'}
          </button>
        </div>
        {showLimits && (
          <div className="mt-3 pt-3 border-t border-blue-500/20 text-xs text-gray-400 space-y-1">
            <p>• Free: 3 чата, 10 сообщений/день, КД 7-60 сек, джиттер ±2 сек</p>
            <p>• Basic: 15 чатов, 300 сообщений/день, КД 7-1800 сек, джиттер 0-10 сек</p>
            <p>• VIP: 30 чатов, 1000 сообщений/день, КД 7-1800 сек, джиттер 0-30 сек</p>
          </div>
        )}
      </div>

      {/* Main form */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Left column - Messages */}
        <div className="space-y-6">
          {/* Campaign name */}
          <div className="card p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <MessageSquare size={18} className="text-kikio-glow" />
              Название рассылки
            </h3>
            <input
              type="text"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder="Моя первая рассылка"
              className="w-full px-4 py-3 rounded-lg bg-black/50 border border-white/10 focus:border-kikio-glow"
            />
          </div>

          {/* Message mode */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2">
                <MessageSquare size={18} className="text-kikio-glow" />
                Сообщения
              </h3>
              
              <div className="flex gap-2 p-1 bg-black/30 rounded-lg">
                <button
                  onClick={() => setMode('single')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    mode === 'single' 
                      ? 'bg-kikio-glow text-black' 
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Одно сообщение
                </button>
                <button
                  onClick={() => setMode('rotating')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    mode === 'rotating' 
                      ? 'bg-kikio-glow text-black' 
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Ротация
                </button>
              </div>
            </div>

            <AnimatePresence mode="popLayout">
              {messages.map((msg, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-3"
                >
                  <div className="flex items-start gap-2">
                    {mode === 'rotating' && (
                      <span className="flex-shrink-0 w-6 h-6 mt-3 rounded-full bg-kikio-glow/20 text-kikio-glow text-sm flex items-center justify-center font-medium">
                        {index + 1}
                      </span>
                    )}
                    <div className="flex-1 relative">
                      <textarea
                        value={msg}
                        onChange={(e) => updateMessage(index, e.target.value)}
                        placeholder={mode === 'single' 
                          ? 'Введите текст сообщения...' 
                          : `Сообщение ${index + 1}...`
                        }
                        rows={3}
                        className="w-full px-4 py-3 rounded-lg bg-black/50 border border-white/10 focus:border-kikio-glow resize-none"
                      />
                      {mode === 'rotating' && messages.length > 1 && (
                        <button
                          onClick={() => removeMessage(index)}
                          className="absolute top-2 right-2 p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-400/10"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {mode === 'rotating' && (
              <button
                onClick={addMessage}
                className="flex items-center gap-2 text-sm text-kikio-glow hover:text-kikio-glow/80 transition-colors mt-2"
              >
                <Plus size={16} />
                Добавить сообщение
              </button>
            )}

            <p className="text-xs text-gray-500 mt-3">
              {mode === 'rotating' 
                ? 'Сообщения будут отправляться по очереди в каждый чат'
                : 'Одно и то же сообщение отправится во все чаты'
              }
            </p>
          </div>
        </div>

        {/* Right column - Chats & Settings */}
        <div className="space-y-6">
          {/* Chat links */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Users size={18} className="text-kikio-glow" />
                Чаты ({chatLinks.filter(l => l.trim()).length})
              </h3>
              
              <button
                onClick={handleValidateChats}
                disabled={isValidating || chatLinks.filter(l => l.trim()).length === 0}
                className="btn btn-secondary text-sm py-2 disabled:opacity-50"
              >
                {isValidating ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <RefreshCw size={16} />
                )}
                <span className="ml-1">Проверить</span>
              </button>
            </div>

            <AnimatePresence mode="popLayout">
              {chatLinks.map((link, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="mb-2"
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={link}
                      onChange={(e) => updateChat(index, e.target.value)}
                      placeholder="https://t.me/chat_name или @chat_name"
                      className="flex-1 px-4 py-2.5 rounded-lg bg-black/50 border border-white/10 focus:border-kikio-glow text-sm"
                    />
                    {chatLinks.length > 1 && (
                      <button
                        onClick={() => removeChat(index)}
                        className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-400/10"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                  
                  {/* Validation result */}
                  {validatedChats.find(c => c.link === link) && (
                    <div className="flex items-center gap-1 mt-1 text-xs">
                      {validatedChats.find(c => c.link === link).valid ? (
                        <>
                          <CheckCircle size={12} className="text-green-400" />
                          <span className="text-green-400">
                            {validatedChats.find(c => c.link === link).title}
                          </span>
                        </>
                      ) : (
                        <>
                          <XCircle size={12} className="text-red-400" />
                          <span className="text-red-400">Недоступен</span>
                        </>
                      )}
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            <button
              onClick={addChat}
              className="flex items-center gap-2 text-sm text-kikio-glow hover:text-kikio-glow/80 transition-colors mt-2"
            >
              <Plus size={16} />
              Добавить чат
            </button>
          </div>

          {/* Delay settings */}
          <div className="card p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Clock size={18} className="text-kikio-glow" />
              Настройки отправки
            </h3>

            <div className="space-y-4">
              {/* Send mode */}
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Режим отправки</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setSendMode('sequential')}
                    className={`p-3 rounded-lg border transition-all text-sm ${
                      sendMode === 'sequential'
                        ? 'border-kikio-glow bg-kikio-glow/10 text-kikio-glow'
                        : 'border-white/10 text-gray-400 hover:border-white/20'
                    }`}
                  >
                    По очереди
                  </button>
                  <button
                    onClick={() => setSendMode('all_at_once')}
                    className={`p-3 rounded-lg border transition-all text-sm ${
                      sendMode === 'all_at_once'
                        ? 'border-kikio-glow bg-kikio-glow/10 text-kikio-glow'
                        : 'border-white/10 text-gray-400 hover:border-white/20'
                    }`}
                  >
                    Все сразу
                  </button>
                </div>
              </div>

              {/* Delay input */}
              {sendMode === 'sequential' && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm text-gray-400">КД между отправками (сек)</label>
                    <span className="text-sm text-kikio-glow font-medium">
                      {delaySeconds} сек
                    </span>
                  </div>
                  <input
                    type="number"
                    min="7"
                    max={maxDelaySeconds}
                    value={delaySeconds}
                    onChange={(e) => setDelaySeconds(Number(e.target.value))}
                    onBlur={(e) => setDelaySeconds(Math.max(7, Math.min(maxDelaySeconds, Number(e.target.value))))}
                    className="w-full px-4 py-2.5 rounded-lg bg-black/50 border border-white/10 focus:border-kikio-glow text-sm"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>7 сек (быстро)</span>
                    <span>{maxDelaySeconds} сек (макс для {tier})</span>
                  </div>
                </div>
              )}

              {/* Jitter settings */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm text-gray-400">Разброс (джиттер)</label>
                  {jitterFixed ? (
                    <span className="text-sm text-kikio-glow font-medium">±2 сек (Free)</span>
                  ) : (
                    <span className="text-sm text-kikio-glow font-medium">±{jitterSeconds} сек</span>
                  )}
                </div>
                {jitterFixed ? (
                  <div className="px-4 py-2.5 rounded-lg bg-black/30 border border-white/10 text-sm text-gray-500">
                    ±2 сек (фиксировано для тарифа Free)
                  </div>
                ) : (
                  <input
                    type="number"
                    min="0"
                    max={jitterMax}
                    value={jitterSeconds}
                    onChange={(e) => setJitterSeconds(Math.max(0, Math.min(jitterMax, Number(e.target.value))))}
                    className="w-full px-4 py-2.5 rounded-lg bg-black/50 border border-white/10 focus:border-kikio-glow text-sm"
                  />
                )}
                {!jitterFixed && (
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>0 сек (без разброса)</span>
                    <span>{jitterMax} сек (макс для {tier})</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Warning */}
          <div className="flex items-start gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/20">
            <AlertTriangle size={20} className="text-red-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="text-red-400 font-medium mb-1">⚠️ Риск блокировки Telegram</p>
              <p className="text-gray-400 mb-3">
                Рассылка в разные чаты может привести к ограничению или полной блокировке вашего Telegram-аккаунта. 
                Сервис не несёт ответственности за возможные последствия.
              </p>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={riskAccepted}
                  onChange={(e) => setRiskAccepted(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded border-gray-600 bg-black/50 text-kikio-glow focus:ring-kikio-glow focus:ring-offset-0"
                />
                <span className="text-gray-300 text-xs">
                  Я понимаю риски и согласен с условиями использования
                </span>
              </label>
            </div>
          </div>

          {/* Schedule fields */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Запустить в (опционально)</label>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/10 focus:border-kikio-glow text-sm"
              />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Остановить в (опционально)</label>
              <input
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/10 focus:border-kikio-glow text-sm"
              />
            </div>
          </div>

          {/* Start button */}
          <motion.button
            onClick={handleCreateAndStart}
            disabled={isCreating || !validatedChats.length || !riskAccepted}
            className="btn btn-primary w-full py-4 text-lg flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {isCreating ? (
              <Loader2 size={24} className="animate-spin" />
            ) : scheduledAt ? (
              <Play size={24} />
            ) : (
              <Play size={24} />
            )}
            <span>{scheduledAt ? 'Запланировать рассылку' : 'Запустить рассылку'}</span>
          </motion.button>
          
          {!riskAccepted && validatedChats.length > 0 && (
            <p className="text-center text-xs text-gray-500 mt-2">
              Подтвердите согласие с рисками для запуска рассылки
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
