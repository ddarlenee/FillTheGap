import { create } from 'zustand'

interface User {
  id: string
  email: string
  name: string
}

interface AuthState {
  token: string | null
  user: User | null
  setAuth: (token: string, user: User) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  token: sessionStorage.getItem('token'),
  user: sessionStorage.getItem('user') ? JSON.parse(sessionStorage.getItem('user')!) : null,
  setAuth: (token, user) => {
    sessionStorage.setItem('token', token)
    sessionStorage.setItem('user', JSON.stringify(user))
    set({ token, user })
  },
  logout: () => {
    sessionStorage.removeItem('token')
    sessionStorage.removeItem('user')
    set({ token: null, user: null })
  },
}))
