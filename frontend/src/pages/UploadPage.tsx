import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSessionStore } from '../store/useSessionStore'
import { postUpload } from '../api/upload'

export default function UploadPage() {
  const navigate = useNavigate()
  const [dragging, setDragging] = useState(false)
  const [text, setText] = useState('')
  const [mode, setMode] = useState<'target' | 'auto'>('target')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const { setSessionId, setResumeText, setMode: storeSetMode } = useSessionStore()

  async function handleSubmit(file?: File) {
    setLoading(true)
    setError('')
    try {
      const result = await postUpload({ file, text: file ? undefined : text })
      setSessionId(result.session_id)
      setResumeText(result.resume_text)
      storeSetMode(mode)
      navigate('/role-selection')
    } catch {
      setError('Upload failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto mt-16 p-8">
      <h1 className="text-3xl font-bold mb-2 text-gray-900">Skills Analyser</h1>
      <p className="text-gray-500 mb-8">Upload your resume to get a personalised skills gap analysis and career roadmap.</p>

      <div
        className={`border-2 border-dashed rounded-xl p-10 text-center mb-6 cursor-pointer transition-colors ${dragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleSubmit(f) }}
        onClick={() => fileRef.current?.click()}
      >
        <p className="text-gray-500">Drag & drop a PDF resume here, or click to browse</p>
        <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleSubmit(f) }} />
      </div>

      <p className="text-center text-gray-400 mb-4">— or paste your resume text —</p>

      <textarea
        className="w-full border rounded-lg p-3 h-36 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
        placeholder="Paste resume text here..."
        value={text}
        onChange={(e) => setText(e.target.value)}
      />

      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setMode('target')}
          className={`flex-1 py-2 rounded-lg border font-medium transition-colors ${mode === 'target' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}
        >
          I know my target role
        </button>
        <button
          onClick={() => setMode('auto')}
          className={`flex-1 py-2 rounded-lg border font-medium transition-colors ${mode === 'auto' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}
        >
          Show me what fits
        </button>
      </div>

      {text && (
        <button
          onClick={() => handleSubmit()}
          disabled={loading}
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold disabled:opacity-50 hover:bg-blue-700"
        >
          {loading ? 'Uploading...' : 'Continue →'}
        </button>
      )}

      {error && <p className="text-red-500 mt-3 text-sm">{error}</p>}

      <div className="mt-8 border-t pt-6">
        <p className="text-sm text-gray-400 mb-2">Have a session ID? Resume your pathway:</p>
        <ResumeSession />
      </div>
    </div>
  )
}

function ResumeSession() {
  const navigate = useNavigate()
  const [id, setId] = useState('')
  const { setSessionId, setAnalysisResult } = useSessionStore()

  async function handleResume() {
    try {
      const res = await fetch(`http://localhost:8000/api/session/${id}`)
      if (!res.ok) throw new Error('Not found')
      const data = await res.json()
      setSessionId(id)
      if (data.analyse) {
        setAnalysisResult(data.analyse)
        navigate('/gap-dashboard')
      }
    } catch {
      alert('Session not found. Check the ID and try again.')
    }
  }

  return (
    <div className="flex gap-2">
      <input
        className="flex-1 border rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        placeholder="Session ID (e.g. 3f8a2c1d-...)"
        value={id}
        onChange={(e) => setId(e.target.value)}
      />
      <button
        onClick={handleResume}
        disabled={!id}
        className="bg-gray-700 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-40 hover:bg-gray-800"
      >
        Resume
      </button>
    </div>
  )
}
