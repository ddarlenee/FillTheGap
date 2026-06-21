import type { TieredSkill } from '../types'

const tierStyle: Record<string, string> = {
  Essential: 'border-red-200 bg-red-50 text-red-700',
  Important: 'border-amber-200 bg-amber-50 text-amber-700',
  'Nice-to-have': 'border-green-200 bg-green-50 text-green-700',
}

const tierOrder = ['Essential', 'Important', 'Nice-to-have'] as const

export default function TieredSkillList({ skills }: { skills: TieredSkill[] }) {
  return (
    <div className="space-y-4">
      {tierOrder.map((tier) => {
        const items = skills.filter((s) => s.tier === tier)
        if (!items.length) return null
        return (
          <div key={tier}>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">{tier}</h4>
            {items.map((s) => (
              <div
                key={s.name}
                className={`border rounded px-3 py-2 mb-1 text-sm ${tierStyle[tier] ?? ''}`}
                title={s.reasoning}
              >
                {s.name}
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}
