import { apiClient } from './client'
import type { ProgressResponse } from '../types'

export async function postProgress(payload: {
  current_role: string
  user_skill_names: string[]
}) {
  const res = await apiClient.post<ProgressResponse>('/api/progress', payload)
  return res.data
}
