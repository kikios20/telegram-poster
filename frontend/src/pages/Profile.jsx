import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore, api } from '../hooks/useStore'
import { User, Mail, Calendar, LogOut } from 'lucide-react'

export function ProfilePage() {
  const navigate = useNavigate()
  const { user, token, logout, fetchUser } = useAuthStore()

  useEffect(() => {
    // If user data is empty, fetch from API
    if (!user && token) {
      fetchUser()
    }
  }, [user, token, fetchUser])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const formatDate = (dateString) => {
    if (!dateString) return '—'
    const date = new Date(dateString)
    return date.toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Профиль</h1>
        <p className="text-gray-400">Информация о вашем аккаунте</p>
      </div>

      <div className="glass-card p-6 space-y-6">
        {/* Status Banner */}
        <div className="flex items-center gap-3 p-4 rounded-lg bg-green-500/10 border border-green-500/20">
          <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
            <User size={20} className="text-green-400" />
          </div>
          <div>
            <p className="text-green-400 font-medium">Вы авторизованы</p>
            <p className="text-gray-400 text-sm">
              {user?.email || 'Загрузка...'}
            </p>
          </div>
        </div>

        {/* User Info */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white border-b border-white/10 pb-2">
            Данные аккаунта
          </h2>

          <div className="grid gap-4">
            {/* Email */}
            <div className="flex items-center gap-4 p-4 rounded-lg bg-white/5">
              <div className="w-10 h-10 rounded-lg bg-kikio-glow/10 flex items-center justify-center">
                <Mail size={18} className="text-kikio-glow" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-500">Email</p>
                <p className="text-white font-medium">
                  {user?.email || '—'}
                </p>
              </div>
            </div>

            {/* Registration Date */}
            <div className="flex items-center gap-4 p-4 rounded-lg bg-white/5">
              <div className="w-10 h-10 rounded-lg bg-kikio-glow/10 flex items-center justify-center">
                <Calendar size={18} className="text-kikio-glow" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-500">Дата регистрации</p>
                <p className="text-white font-medium">
                  {formatDate(user?.created_at)}
                </p>
              </div>
            </div>

            {/* Account Type */}
            <div className="flex items-center gap-4 p-4 rounded-lg bg-white/5">
              <div className="w-10 h-10 rounded-lg bg-kikio-glow/10 flex items-center justify-center">
                <User size={18} className="text-kikio-glow" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-500">Тип аккаунта</p>
                <p className="text-white font-medium">
                  {user?.is_premium ? 'Premium' : 'Бесплатный'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Logout Button */}
        <div className="pt-4 border-t border-white/10">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full justify-center px-6 py-3 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
          >
            <LogOut size={20} />
            <span className="font-medium">Выйти из аккаунта</span>
          </button>
        </div>
      </div>
    </div>
  )
}
