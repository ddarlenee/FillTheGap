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
  const { setResumeText, setMode: storeSetMode } = useSessionStore()

  async function handleSubmit(file?: File) {
    setLoading(true)
    setError('')
    try {
      const result = await postUpload({ file, text: file ? undefined : text })
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
      <h1 className="text-3xl font-bold mb-2 text-gray-900">FillTheGap</h1>
      <p className="text-gray-500 mb-8">Get a personalised skills gap analysis and career roadmap.</p>

      {/* Step 1 — pick path */}
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Step 1 — What are you looking for?</p>
      <div className="grid grid-cols-2 gap-3 mb-8">
        <button
          onClick={() => setMode('target')}
          className={`rounded-xl border-2 p-4 text-left transition-all ${
            mode === 'target'
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-200 bg-white hover:border-gray-300'
          }`}
        >
          <div className={`text-lg mb-1 font-semibold ${mode === 'target' ? 'text-blue-700' : 'text-gray-800'}`}>
            🎯 Target role
          </div>
          <p className="text-xs text-gray-500 leading-relaxed">I know the role I want — show me what I'm missing</p>
        </button>
        <button
          onClick={() => setMode('auto')}
          className={`rounded-xl border-2 p-4 text-left transition-all ${
            mode === 'auto'
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-200 bg-white hover:border-gray-300'
          }`}
        >
          <div className={`text-lg mb-1 font-semibold ${mode === 'auto' ? 'text-blue-700' : 'text-gray-800'}`}>
            ✨ Best fit
          </div>
          <p className="text-xs text-gray-500 leading-relaxed">Not sure yet — match me to roles that suit my skills</p>
        </button>
      </div>

      {/* Step 2 — upload */}
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Step 2 — Upload your resume</p>
      <div
        className={`border-2 border-dashed rounded-xl p-10 text-center mb-4 cursor-pointer transition-colors ${dragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}`}
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
    </div>
  )
}
