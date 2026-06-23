import { apiClient } from './client'
import type { AnalyseResponse } from '../types'

export async function postAnalyse(payload: {
  resume_text?: string
  target_role?: string
  user_skill_names?: string[]
}, token?: string | null) {
  const res = await apiClient.post<AnalyseResponse>('/api/analyse', payload, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  return res.data
}