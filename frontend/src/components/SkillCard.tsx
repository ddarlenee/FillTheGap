import { useState } from 'react'
import type { ExtractedSkill } from '../types'

const confidenceColour: Record<string, string> = {
  High: 'bg-green-100 text-green-700',
  Medium: 'bg-yellow-100 text-yellow-700',
  Low: 'bg-gray-100 text-gray-500',
}

export default function SkillCard({ skill }: { skill: ExtractedSkill }) {
  const [open, setOpen] = useState(false)
  return (
    <div
      className="border rounded-lg p-3 mb-2 cursor-pointer hover:bg-gray-50 transition-colors"
      onClick={() => setOpen(!open)}
    >
      <div className="flex items-center justify-between">
        <span className="font-medium text-sm text-gray-800">{skill.name}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${confidenceColour[skill.confidence] ?? 'bg-gray-100 text-gray-500'}`}>
          {skill.confidence}
        </span>
      </div>
      {open && (
        <p className="text-xs text-gray-500 mt-2 italic border-t pt-2">
          "{skill.evidence}"
        </p>
      )}
    </div>
  )
}
