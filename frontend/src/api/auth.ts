import { apiClient } from './client'
import type { CareerRung } from '../types'

export interface AuthResponse {
  access_token: string
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

export async function completeHistoryStep(entryId: string, stepIndex: number) {
  const res = await apiClient.post(`/api/auth/history/${entryId}/complete-step`, { step_index: stepIndex })
  return res.data
}

export async function saveCareerStage(rung: CareerRung, userSkills: string[], sourceEntryId?: string) {
  const res = await apiClient.post('/api/auth/history/career-stage', {
    role: rung.role,
    transferability_score: rung.transferability_score,
    skill_delta: rung.skill_delta,
    next_steps: rung.next_steps,
    user_skills: userSkills,
    source_entry_id: sourceEntryId ?? null,
  })
  return res.data
}

export async function restoreSession(token: string) {
  const res = await apiClient.get('/api/auth/restore', {
    headers: { Authorization: `Bearer ${token}` },
  })
  return res.data.session as { analyse?: unknown; progress?: unknown } | null
}
