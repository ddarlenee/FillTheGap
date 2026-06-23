import { apiClient } from './client'

export async function postUpload(payload: { file?: File; text?: string }) {
  const form = new FormData()
  if (payload.file) form.append('file', payload.file)
  if (payload.text) form.append('text', payload.text)
  const res = await apiClient.post<{ resume_text: string }>('/api/upload', form)
  return res.data
}
