import { apiClient } from './client'

export async function signup(email: string, password: string) {
  const res = await apiClient.post('/api/auth/signup', { email, password })
  return res.data as { token: string; email: string }
}

export async function login(email: string, password: string) {
  const res = await apiClient.post('/api/auth/login', { email, password })
  return res.data as { token: string; email: string }
}
