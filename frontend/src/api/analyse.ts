import { apiClient } from './client'
import type { AnalyseResponse } from '../types'

export async function postAnalyse(payload: {
  session_id: string
  resume_text: string
  target_role?: string
}) {
  const res = await apiClient.post<AnalyseResponse>('/api/analyse', payload)
  return res.data
}
