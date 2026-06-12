import { createContext, useContext, useEffect, useState } from 'react'
import { api, setAuthFailureHandler } from './api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('cg_user')
    return raw ? JSON.parse(raw) : null
  })
  const [booting, setBooting] = useState(!!localStorage.getItem('cg_token'))

  useEffect(() => {
    setAuthFailureHandler(() => {
      localStorage.removeItem('cg_token')
      localStorage.removeItem('cg_user')
      setUser(null)
    })
  }, [])

  // Validate the stored token on first load
  useEffect(() => {
    if (!localStorage.getItem('cg_token')) return
    api.me()
      .then((u) => { setUser(u); localStorage.setItem('cg_user', JSON.stringify(u)) })
      .catch(() => {})
      .finally(() => setBooting(false))
  }, [])

  const login = async (email, password) => {
    const { token, user: u } = await api.login(email, password)
    localStorage.setItem('cg_token', token)
    localStorage.setItem('cg_user', JSON.stringify(u))
    setUser(u)
    return u
  }

  const register = async (data) => {
    const { token, user: u } = await api.register(data)
    localStorage.setItem('cg_token', token)
    localStorage.setItem('cg_user', JSON.stringify(u))
    setUser(u)
    return u
  }

  const logout = async () => {
    try { await api.logout() } catch { /* token may already be gone */ }
    localStorage.removeItem('cg_token')
    localStorage.removeItem('cg_user')
    setUser(null)
  }

  const isManager = user?.role === 'MANAGER'
  // Senior managers (band b5l/b5h/b4l/b4h/b2) can view the full registered-people directory.
  const SENIOR_BANDS = ['b5l', 'b5h', 'b4l', 'b4h', 'b2']
  const isSeniorManager = isManager && SENIOR_BANDS.includes(user?.band)
  // Top-level leadership (B4L and above, incl. the CEO band b2) get the org-wide risk dashboard.
  const LEADERSHIP_BANDS = ['b4l', 'b4h', 'b2']
  const isLeadership = isManager && LEADERSHIP_BANDS.includes(user?.band)
  // Delivery metrics only apply once a person is actually onboarded and working.
  const isOnboarded = user?.currentStage === 'ONBOARDED'
  const roleLabel = isLeadership ? 'Leadership' : isSeniorManager ? 'Senior Manager' : isManager ? 'Manager' : 'Developer'

  return (
    <AuthContext.Provider value={{ user, isManager, isSeniorManager, isLeadership, isOnboarded, roleLabel, booting, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
