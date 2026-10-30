import { createContext, useContext, useEffect, useMemo, useState } from 'react'

import { getCurrentUser, loginUser, registerUser } from '../api/client'

const AuthContext = createContext(null)
const TOKEN_KEY = 'foodloop.accessToken'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    const token = window.localStorage.getItem(TOKEN_KEY)

    if (!token) {
      setLoading(false)
      return () => {
        active = false
      }
    }

    getCurrentUser()
      .then((currentUser) => {
        if (active) setUser(currentUser)
      })
      .catch(() => {
        window.localStorage.removeItem(TOKEN_KEY)
        if (active) setUser(null)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  async function establishSession(authRequest, payload) {
    const session = await authRequest(payload)
    window.localStorage.setItem(TOKEN_KEY, session.access_token)
    setUser(session.user)
    return session.user
  }

  async function login(payload) {
    return establishSession(loginUser, payload)
  }

  async function register(payload) {
    return establishSession(registerUser, payload)
  }

  function logout() {
    window.localStorage.removeItem(TOKEN_KEY)
    setUser(null)
  }

  const value = useMemo(
    () => ({ user, loading, login, register, logout }),
    [user, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
