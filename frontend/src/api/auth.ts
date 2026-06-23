import { apiClient } from './client'

export interface AuthResponse {
  access_token: string
  token_type: string
  user: { id: string; email: string; name: string }
}

export async function register(email: string, password: string, name: string) {
  const res = await apiClient.post<AuthResponse>('/api/auth/register', { email, password, name })
  return res.data
}

export async function login(email: string, password: string) {
  const res = await apiClient.post<AuthResponse>('/api/auth/login', { email, password })
  return res.data
}

export async function fetchHistory(token: string) {
  const res = await apiClient.get('/api/auth/history', {
    headers: { Authorization: `Bearer ${token}` },
  })
  return res.data.history
}