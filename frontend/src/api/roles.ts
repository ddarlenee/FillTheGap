import { apiClient } from './client'

export async function getRoles(q = '') {
  const res = await apiClient.get<{ roles: string[] }>('/api/roles', { params: { q } })
  return res.data.roles
}
