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

  const logout = async () => {
    try { await api.logout() } catch { /* token may already be gone */ }
    localStorage.removeItem('cg_token')
    localStorage.removeItem('cg_user')
    setUser(null)
  }

  const isLead = user?.role === 'LEAD'

  return (
    <AuthContext.Provider value={{ user, isLead, booting, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
