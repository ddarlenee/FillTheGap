import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AnalyseResponse, ProgressResponse } from '../types'

interface SessionState {
  token: string | null
  userEmail: string | null
  resumeText: string | null
  selectedRole: string | null
  mode: 'target' | 'auto'
  analysisResult: AnalyseResponse | null
  progressResult: ProgressResponse | null
  setAuth: (token: string, email: string) => void
  logout: () => void
  setResumeText: (text: string) => void
  setSelectedRole: (role: string) => void
  setMode: (mode: 'target' | 'auto') => void
  setAnalysisResult: (result: AnalyseResponse) => void
  setProgressResult: (result: ProgressResponse) => void
  reset: () => void
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      token: null,
      userEmail: null,
      resumeText: null,
      selectedRole: null,
      mode: 'target',
      analysisResult: null,
      progressResult: null,
      setAuth: (token, email) => set({ token, userEmail: email }),
      logout: () => set({
        token: null, userEmail: null, resumeText: null,
        selectedRole: null, mode: 'target', analysisResult: null, progressResult: null,
      }),
      setResumeText: (text) => set({ resumeText: text }),
      setSelectedRole: (role) => set({ selectedRole: role }),
      setMode: (mode) => set({ mode }),
      setAnalysisResult: (result) => set({ analysisResult: result }),
      setProgressResult: (result) => set({ progressResult: result }),
      reset: () => set({
        resumeText: null, selectedRole: null,
        mode: 'target', analysisResult: null, progressResult: null,
      }),
    }),
    { name: 'skills-analyser-auth', partialize: (s) => ({ token: s.token, userEmail: s.userEmail }) }
  )
)
