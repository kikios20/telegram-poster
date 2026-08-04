import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useCampaignStore, useTelegramStore, api } from '../hooks/useStore'
import { 
  History, 
  Play, 
  Pause, 
  Square, 
  Trash2, 
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  ChevronDown,
  RefreshCw,
  ExternalLink,
  AlertTriangle,
  Download
} from 'lucide-react'

export function HistoryPage() {
  const { campaigns, fetchCampaigns, controlCampaign, deleteCampaign, getCampaign, currentCampaign, isLoading } = useCampaignStore()
  const { status } = useTelegramStore()
  const [expandedId, setExpandedId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  useEffect(() => {
    if (status.connected) {
      fetchCampaigns()
    }
  }, [status.connected])

  if (!status.connected) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <History size={48} className="mx-auto mb-4 text-gray-600" />
          <p className="text-gray-500">Подключите Telegram для просмотра истории</p>
        </div>
      </div>
    )
  }

  const handleExpand = async (id) => {
    if (expandedId === id) {
      setExpandedId(null)
    } else {
      setExpandedId(id)
      await getCampaign(id)
    }
  }

  const handleControl = async (id, action) => {
    try {
      await controlCampaign(id, action)
    } catch (error) {
      console.error('Control failed:', error)
    }
  }

  const handleDelete = async (id) => {
    if (confirm('Удалить рассылку? Это действие нельзя отменить.')) {
      setDeletingId(id)
      try {
        await deleteCampaign(id)
      } catch (error) {
        console.error('Delete failed:', error)
      } finally {
        setDeletingId(null)
      }
    }
  }

  const handleExportCSV = async (campaignId) => {
    try {
      const response = await api.get(`/campaigns/${campaignId}/export-csv`, {
        responseType: 'blob',
      })
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `campaign_${campaignId}_logs.csv`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Export failed:', error)
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'running': return 'text-blue-400'
      case 'completed': return 'text-green-400'
      case 'paused': return 'text-yellow-400'
      case 'stopped': return 'text-red-400'
      default: return 'text-gray-400'
    }
  }

  const getStatusBg = (status) => {
    switch (status) {
      case 'running': return 'bg-blue-500/10 border-blue-500/30'
      case 'completed': return 'bg-green-500/10 border-green-500/30'
      case 'paused': return 'bg-yellow-500/10 border-yellow-500/30'
      case 'stopped': return 'bg-red-500/10 border-red-500/30'
      default: return 'bg-gray-500/10 border-gray-500/30'
    }
  }

  const formatDate = (dateStr) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">История рассылок</h1>
          <p className="text-gray-400 mt-1">
            Всего рассылок: {campaigns.length}
          </p>
        </div>
        
        <button
          onClick={() => fetchCampaigns()}
          disabled={isLoading}
          className="btn btn-secondary flex items-center gap-2"
        >
          <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
          Обновить
        </button>
      </div>

      {/* Campaign list */}
      {campaigns.length === 0 ? (
        <div className="card p-12 text-center">
          <History size={48} className="mx-auto mb-4 text-gray-600" />
          <p className="text-gray-400">Нет рассылок</p>
          <p className="text-gray-500 text-sm mt-1">
            Создайте рассылку на странице "Рассылка"
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {campaigns.map((campaign, index) => (
            <motion.div
              key={campaign.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="card overflow-hidden"
            >
              {/* Header */}
              <div 
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors"
                onClick={() => handleExpand(campaign.id)}
              >
                <div className="flex items-center gap-4">
                  <div className={`px-3 py-1 rounded-full border text-sm font-medium ${getStatusBg(campaign.status)} ${getStatusColor(campaign.status)}`}>
                    {campaign.status === 'running' && <Loader2 size={14} className="inline animate-spin mr-1" />}
                    {campaign.status === 'paused' && <Pause size={14} className="inline mr-1" />}
                    {campaign.status}
                  </div>
                  
                  <div>
                    <h3 className="font-medium">{campaign.name}</h3>
                    <p className="text-sm text-gray-500 flex items-center gap-2">
                      <Clock size={12} />
                      {formatDate(campaign.created_at)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {/* Stats */}
                  <div className="hidden sm:flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <span className="text-gray-500">Всего:</span>
                      <span className="text-white font-medium">{campaign.stats.total}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <CheckCircle size={14} className="text-green-400" />
                      <span className="text-green-400">{campaign.stats.sent}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <XCircle size={14} className="text-red-400" />
                      <span className="text-red-400">{campaign.stats.failed}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    {campaign.status === 'running' && (
                      <button
                        onClick={() => handleControl(campaign.id, 'pause')}
                        className="p-2 rounded-lg text-yellow-400 hover:bg-yellow-400/10"
                        title="Пауза"
                      >
                        <Pause size={18} />
                      </button>
                    )}
                    {campaign.status === 'paused' && (
                      <button
                        onClick={() => handleControl(campaign.id, 'resume')}
                        className="p-2 rounded-lg text-green-400 hover:bg-green-400/10"
                        title="Продолжить"
                      >
                        <Play size={18} />
                      </button>
                    )}
                    {(campaign.status === 'running' || campaign.status === 'paused') && (
                      <button
                        onClick={() => handleControl(campaign.id, 'stop')}
                        className="p-2 rounded-lg text-red-400 hover:bg-red-400/10"
                        title="Остановить"
                      >
                        <Square size={18} />
                      </button>
                    )}
                    <button
                      onClick={() => handleExportCSV(campaign.id)}
                      className="p-2 rounded-lg text-gray-500 hover:text-green-400 hover:bg-green-400/10"
                      title="Экспорт в CSV"
                    >
                      <Download size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(campaign.id)}
                      disabled={deletingId === campaign.id}
                      className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-400/10 disabled:opacity-50"
                      title="Удалить"
                    >
                      {deletingId === campaign.id ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <Trash2 size={18} />
                      )}
                    </button>
                    <ChevronDown 
                      size={20} 
                      className={`text-gray-500 transition-transform ${expandedId === campaign.id ? 'rotate-180' : ''}`}
                    />
                  </div>
                </div>
              </div>

              {/* Expanded details */}
              <AnimatePresence>
                {expandedId === campaign.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-white/10"
                  >
                    <div className="p-4 bg-black/20">
                      {isLoading && currentCampaign?.campaign_id === campaign.id ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 size={24} className="animate-spin text-kikio-glow" />
                        </div>
                      ) : currentCampaign ? (
                        <div className="space-y-4">
                          {/* Progress bar */}
                          <div>
                            <div className="flex items-center justify-between text-sm mb-2">
                              <span className="text-gray-400">Прогресс</span>
                              <span className="text-white">
                                {currentCampaign.progress.sent + currentCampaign.progress.failed} / {currentCampaign.progress.total}
                              </span>
                            </div>
                            <div className="h-2 bg-black/50 rounded-full overflow-hidden">
                              <motion.div
                                className="h-full bg-gradient-to-r from-kikio-glow to-green-400"
                                initial={{ width: 0 }}
                                animate={{ 
                                  width: `${((currentCampaign.progress.sent + currentCampaign.progress.failed) / currentCampaign.progress.total) * 100}%` 
                                }}
                                transition={{ duration: 0.5 }}
                              />
                            </div>
                          </div>

                          {/* Logs */}
                          <div>
                            <h4 className="text-sm font-medium text-gray-400 mb-2">Последние действия</h4>
                            <div className="space-y-2 max-h-60 overflow-y-auto">
                              {currentCampaign.logs.map((log, i) => (
                                <div 
                                  key={i}
                                  className="flex items-center gap-3 p-2 rounded-lg bg-black/30"
                                >
                                  {log.status === 'success' ? (
                                    <CheckCircle size={14} className="text-green-400" />
                                  ) : log.status === 'failed' ? (
                                    <XCircle size={14} className="text-red-400" />
                                  ) : (
                                    <Clock size={14} className="text-gray-500" />
                                  )}
                                  <span className="text-sm flex-1 truncate">
                                    {log.chat_title || log.chat_id}
                                  </span>
                                  {log.error && (
                                    <span className="text-xs text-red-400 truncate max-w-[200px]">
                                      {log.error}
                                    </span>
                                  )}
                                  <span className="text-xs text-gray-500">
                                    {log.sent_at ? formatDate(log.sent_at) : '...'}
                                  </span>
                                </div>
                              ))}
                              {currentCampaign.logs.length === 0 && (
                                <p className="text-sm text-gray-500 text-center py-4">
                                  Логи пусты
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className="text-center text-gray-500 py-4">
                          Не удалось загрузить детали
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
