import { create } from 'zustand'
import type { AnalyseResponse, ProgressResponse } from '../types'

interface SessionState {
  sessionId: string | null
  resumeText: string | null
  selectedRole: string | null
  mode: 'target' | 'auto'
  analysisResult: AnalyseResponse | null
  progressResult: ProgressResponse | null
  setSessionId: (id: string) => void
  setResumeText: (text: string) => void
  setSelectedRole: (role: string) => void
  setMode: (mode: 'target' | 'auto') => void
  setAnalysisResult: (result: AnalyseResponse) => void
  setProgressResult: (result: ProgressResponse) => void
  reset: () => void
}

export const useSessionStore = create<SessionState>((set) => ({
  sessionId: null,
  resumeText: null,
  selectedRole: null,
  mode: 'target',
  analysisResult: null,
  progressResult: null,
  setSessionId: (id) => set({ sessionId: id }),
  setResumeText: (text) => set({ resumeText: text }),
  setSelectedRole: (role) => set({ selectedRole: role }),
  setMode: (mode) => set({ mode }),
  setAnalysisResult: (result) => set({ analysisResult: result }),
  setProgressResult: (result) => set({ progressResult: result }),
  reset: () => set({
    sessionId: null, resumeText: null, selectedRole: null,
    mode: 'target', analysisResult: null, progressResult: null,
  }),
}))
