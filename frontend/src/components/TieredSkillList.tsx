import { useState } from 'react'
import type { TieredSkill, ExtractedSkill } from '../types'

const unmatchedStyle: Record<string, string> = {
  Essential: 'border-red-200 bg-red-50 text-red-700',
  Important: 'border-amber-200 bg-amber-50 text-amber-700',
  'Nice-to-have': 'border-orange-200 bg-orange-50 text-orange-700',
}

const matchedStyle = 'border-l-4 border-l-blue-500 border-blue-200 bg-blue-50 text-blue-800'

const tierOrder = ['Essential', 'Important', 'Nice-to-have'] as const

interface Props {
  skills: TieredSkill[]
  userSkills?: ExtractedSkill[]
}

function MatchedSkillRow({ skill, evidenceMap }: { skill: TieredSkill; evidenceMap: Map<string, string> }) {
  const [open, setOpen] = useState(false)
  const quotes = skill.matched_by
    .map((name) => ({ name, evidence: evidenceMap.get(name) }))
    .filter((e) => e.evidence)

  return (
    <div
      className={`border rounded px-3 py-2 mb-1 text-sm ${matchedStyle} ${quotes.length ? 'cursor-pointer' : ''}`}
      onClick={() => quotes.length && setOpen((v) => !v)}
    >
      <div className="flex items-center justify-between gap-2">
        <span>{skill.name}</span>
        <span className="text-blue-500 font-bold shrink-0">✓</span>
      </div>
      <div className="text-xs mt-0.5 text-blue-600 opacity-80">
        via {skill.matched_by.join(', ')}
        {quotes.length > 0 && (
          <span className="ml-1 text-blue-400">{open ? '▲' : '▼'}</span>
        )}
      </div>
      {open && quotes.map(({ name, evidence }) => (
        <blockquote key={name} className="mt-2 border-l-2 border-blue-300 pl-2 text-xs text-blue-700 italic opacity-90">
          "{evidence}"
        </blockquote>
      ))}
    </div>
  )
}

export default function TieredSkillList({ skills, userSkills = [] }: Props) {
  const evidenceMap = new Map(userSkills.map((s) => [s.name, s.evidence]))

  return (
    <div className="space-y-4">
      {tierOrder.map((tier) => {
        const items = skills.filter((s) => s.tier === tier)
        if (!items.length) return null
        return (
          <div key={tier}>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">{tier}</h4>
            {items.map((s) => {
              const matched = s.matched_by && s.matched_by.length > 0
              if (matched) {
                return <MatchedSkillRow key={s.name} skill={s} evidenceMap={evidenceMap} />
              }
              return (
                <div
                  key={s.name}
                  className={`border rounded px-3 py-2 mb-1 text-sm ${unmatchedStyle[tier] ?? ''}`}
                  title={s.reasoning}
                >
                  {s.name}
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
