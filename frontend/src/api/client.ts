import axios from 'axios'
import { useSessionStore } from '../store/useSessionStore'

export const apiClient = axios.create({
  baseURL: 'http://localhost:8000',
})

apiClient.interceptors.request.use((config) => {
  const token = useSessionStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})
