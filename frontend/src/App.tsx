import { Routes, Route } from 'react-router-dom'

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Routes>
        <Route path="/" element={<div className="p-8 text-2xl font-bold text-gray-800">Skills Analyser</div>} />
      </Routes>
    </div>
  )
}
