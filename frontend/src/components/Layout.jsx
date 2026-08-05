import { Outlet, Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { LogoText } from './Logo'
import { useAuthStore, useTelegramStore } from '../hooks/useStore'
import { 
  Send, 
  History, 
  Settings, 
  LogOut, 
  Menu, 
  X,
  User,
  CheckCircle,
  XCircle,
  UserCircle
} from 'lucide-react'
import { useState } from 'react'

export function Layout() {
  const location = useLocation()
  const { user, logout } = useAuthStore()
  const { status } = useTelegramStore()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const navItems = [
    { path: '/dashboard', label: 'Рассылка', icon: Send },
    { path: '/history', label: 'История', icon: History },
    { path: '/settings', label: 'Настройки', icon: Settings },
    { path: '/profile', label: 'Профиль', icon: UserCircle },
  ]

  const isActive = (path) => location.pathname === path

  return (
    <div className="min-h-screen bg-animated bg-grid">
      {/* Background effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-kikio-glow/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-kikio-glow/5 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 glass-strong">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/dashboard" className="flex items-center">
              <LogoText />
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`
                    flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200
                    ${isActive(item.path) 
                      ? 'bg-kikio-glow/10 text-kikio-glow' 
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }
                  `}
                >
                  <item.icon size={18} />
                  <span>{item.label}</span>
                </Link>
              ))}
            </nav>

            {/* Right side */}
            <div className="flex items-center gap-4">
              {/* Telegram status */}
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/30 border border-white/10">
                {status.connected ? (
                  <>
                    <span className="status-dot status-success" />
                    <span className="text-sm text-green-400">
                      {status.username || status.phone}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="status-dot status-error" />
                    <span className="text-sm text-gray-500">Не подключен</span>
                  </>
                )}
              </div>

              {/* User menu */}
              <div className="hidden sm:flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-kikio-glow/20 flex items-center justify-center">
                  <User size={16} className="text-kikio-glow" />
                </div>
                <span className="text-sm text-gray-400">{user?.email}</span>
                <button
                  onClick={logout}
                  className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                >
                  <LogOut size={18} />
                </button>
              </div>

              {/* Mobile menu button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10"
              >
                {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden border-t border-white/10"
            >
              <div className="px-4 py-4 space-y-2">
                {navItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`
                      flex items-center gap-3 px-4 py-3 rounded-lg transition-all
                      ${isActive(item.path) 
                        ? 'bg-kikio-glow/10 text-kikio-glow' 
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                      }
                    `}
                  >
                    <item.icon size={20} />
                    <span>{item.label}</span>
                  </Link>
                ))}
                
                <div className="pt-2 border-t border-white/10">
                  <div className="flex items-center gap-2 px-4 py-2 text-sm text-gray-500">
                    {status.connected ? (
                      <>
                        <CheckCircle size={16} className="text-green-400" />
                        <span>@{status.username || status.phone}</span>
                      </>
                    ) : (
                      <>
                        <XCircle size={16} className="text-red-400" />
                        <span>Не подключен</span>
                      </>
                    )}
                  </div>
                  <button
                    onClick={logout}
                    className="flex items-center gap-3 w-full px-4 py-3 rounded-lg text-red-400 hover:bg-red-400/10 transition-colors"
                  >
                    <LogOut size={20} />
                    <span>Выйти</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Main content */}
      <main className="pt-20 pb-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-black/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-gray-500">
            <span>Kikio Telegram Poster © 2026</span>
            <div className="flex items-center gap-3">
              <Link to="/terms" className="hover:text-gray-400">Условия</Link>
              <span>·</span>
              <Link to="/privacy" className="hover:text-gray-400">Конфиденциальность</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
