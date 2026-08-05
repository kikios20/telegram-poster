import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import axios from 'axios'

const API_URL = 'https://telegram-poster-api.onrender.com/api'

// Create axios instance with interceptors
const api = axios.create({
  baseURL: API_URL,
})

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle token expiration
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout()
    }
    return Promise.reject(error)
  }
)

// Auth Store with persist middleware
export const useAuthStore = create(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      isAuthenticated: false,

      login: async (email, password) => {
        console.log('LOGIN: starting...')
        const response = await api.post('/auth/login',
          `username=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`,
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded'
            }
          }
        )
        console.log('LOGIN RESPONSE:', JSON.stringify(response.data))
        const { access_token } = response.data
        console.log('TOKEN RECEIVED:', access_token)
        set({ token: access_token, isAuthenticated: true })
        console.log('STORE UPDATED:', useAuthStore.getState())
        get().fetchUser()
        return true
      },

      loginWithApiKey: async (apiKey) => {
        const response = await api.post('/auth/login/api-key', null, {
          params: { api_key: apiKey }
        })
        const { access_token } = response.data
        set({ token: access_token, isAuthenticated: true })
        await get().fetchUser()
        return true
      },

      fetchUser: async () => {
        try {
          const response = await api.get('/auth/me')
          set({ user: response.data })
        } catch (error) {
          console.error('Failed to fetch user:', error)
        }
      },

      logout: () => set({ token: null, user: null, isAuthenticated: false }),
    }),
    { name: 'kikio-auth' }
  )
)

// Telegram Store
export const useTelegramStore = create((set, get) => ({
  status: {
    connected: false,
    phone: null,
    username: null,
  },
  isConnecting: false,
  error: null,

  fetchStatus: async () => {
    try {
      const response = await api.get('/telegram/status')
      set({ status: response.data, error: null })
    } catch (error) {
      set({ status: { connected: false }, error: null })
    }
  },
  
  connect: async (apiId, apiHash, phone) => {
    set({ isConnecting: true, error: null })
    try {
      const response = await api.post('/telegram/connect', {
        api_id: parseInt(apiId),
        api_hash: apiHash,
        phone: phone
      })
      return response.data
    } catch (error) {
      set({ error: error.response?.data?.detail || 'Connection failed' })
      throw error
    } finally {
      set({ isConnecting: false })
    }
  },
  
  verifyCode: async (sessionId, code) => {
    set({ isConnecting: true, error: null })
    try {
      const response = await api.post('/telegram/verify-code', {
        session_id: sessionId,
        code: code
      })
      await get().fetchStatus()
      return response.data
    } catch (error) {
      set({ error: error.response?.data?.detail || 'Verification failed' })
      throw error
    } finally {
      set({ isConnecting: false })
    }
  },
  
  verify2FA: async (sessionId, password) => {
    set({ isConnecting: true, error: null })
    try {
      const response = await api.post('/telegram/verify-2fa', {
        session_id: sessionId,
        password: password
      })
      await get().fetchStatus()
      return response.data
    } catch (error) {
      set({ error: error.response?.data?.detail || '2FA verification failed' })
      throw error
    } finally {
      set({ isConnecting: false })
    }
  },
  
  validateChat: async (link) => {
    try {
      const response = await api.post('/telegram/validate-chat', { link })
      return response.data
    } catch (error) {
      return { valid: false, error: error.response?.data?.detail || 'Validation failed' }
    }
  },
  
  logout: async () => {
    try {
      await api.post('/telegram/logout')
      set({ status: { connected: false } })
    } catch (error) {
      console.error('Logout failed:', error)
    }
  },
}))

// Campaign Store
export const useCampaignStore = create((set, get) => ({
  campaigns: [],
  currentCampaign: null,
  isLoading: false,
  error: null,
  
  fetchCampaigns: async () => {
    set({ isLoading: true })
    try {
      const response = await api.get('/campaigns/')
      set({ campaigns: response.data.campaigns, error: null })
    } catch (error) {
      set({ error: error.response?.data?.detail || 'Failed to fetch campaigns' })
    } finally {
      set({ isLoading: false })
    }
  },
  
  createCampaign: async (data) => {
    set({ isLoading: true, error: null })
    try {
      const response = await api.post('/campaigns/', data)
      set((state) => ({
        campaigns: [response.data, ...state.campaigns],
        error: null
      }))
      return response.data
    } catch (error) {
      set({ error: error.response?.data?.detail || 'Failed to create campaign' })
      throw error
    } finally {
      set({ isLoading: false })
    }
  },
  
  getCampaign: async (id) => {
    set({ isLoading: true })
    try {
      const response = await api.get(`/campaigns/${id}`)
      set({ currentCampaign: response.data, error: null })
      return response.data
    } catch (error) {
      set({ error: error.response?.data?.detail || 'Failed to fetch campaign' })
      throw error
    } finally {
      set({ isLoading: false })
    }
  },
  
  startCampaign: async (id) => {
    try {
      await api.post(`/campaigns/${id}/start`)
      await get().fetchCampaigns()
      return true
    } catch (error) {
      set({ error: error.response?.data?.detail || 'Failed to start campaign' })
      throw error
    }
  },
  
  controlCampaign: async (id, action) => {
    try {
      await api.post('/campaigns/control', {
        campaign_id: id,
        action: action
      })
      await get().fetchCampaigns()
      return true
    } catch (error) {
      set({ error: error.response?.data?.detail || `Failed to ${action} campaign` })
      throw error
    }
  },
  
  deleteCampaign: async (id) => {
    try {
      await api.delete(`/campaigns/${id}`)
      set((state) => ({
        campaigns: state.campaigns.filter(c => c.id !== id),
        error: null
      }))
      return true
    } catch (error) {
      set({ error: error.response?.data?.detail || 'Failed to delete campaign' })
      throw error
    }
  },
}))

export { api }
