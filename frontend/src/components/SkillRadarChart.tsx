import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { TieredSkill } from '../types'

interface Props {
  roleSkills: TieredSkill[]
}

const TIER_COLOUR: Record<string, string> = {
  Essential: '#ef4444',
  Important: '#f59e0b',
  'Nice-to-have': '#22c55e',
}

function ChartTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 min-w-[170px]">
      <p className="font-semibold text-sm mb-1" style={{ color: TIER_COLOUR[d.tier] ?? '#374151' }}>
        {d.tier}
      </p>
      <p className="text-2xl font-bold text-blue-600 mb-2">{d.realPct}%</p>
      <div className="flex justify-between text-xs text-gray-500 gap-6">
        <div className="text-center">
          <p className="font-semibold text-gray-800 text-base">{d.count.total}</p>
          <p>required</p>
        </div>
        <div className="text-center">
          <p className="font-semibold text-blue-700 text-base">{d.count.have}</p>
          <p>possessed</p>
        </div>
      </div>
    </div>
  )
}

export default function SkillRadarChart({ roleSkills }: Props) {
  const counts: Record<string, { have: number; total: number }> = {
    Essential: { have: 0, total: 0 },
    Important: { have: 0, total: 0 },
    'Nice-to-have': { have: 0, total: 0 },
  }

  for (const s of roleSkills) {
    if (!counts[s.tier]) continue
    counts[s.tier].total++
    if (s.matched_by && s.matched_by.length > 0) counts[s.tier].have++
  }

  const pct = (t: string) =>
    counts[t].total === 0 ? 0 : Math.round((counts[t].have / counts[t].total) * 100)

  const display = (t: string) => Math.max(pct(t), 5)

  const data = [
    { tier: 'Essential',    Role: 100, You: display('Essential'),    realPct: pct('Essential'),    count: counts['Essential'] },
    { tier: 'Important',    Role: 100, You: display('Important'),    realPct: pct('Important'),    count: counts['Important'] },
    { tier: 'Nice-to-have', Role: 100, You: display('Nice-to-have'), realPct: pct('Nice-to-have'), count: counts['Nice-to-have'] },
  ]

  return (
    <div className="bg-white border rounded-xl p-6 mb-6">
      <h2 className="font-semibold text-gray-700 mb-5">Competency Chart</h2>
      <ResponsiveContainer width="100%" height={320}>
        <RadarChart data={data} outerRadius={100}>
          <PolarGrid />
          <PolarAngleAxis
            dataKey="tier"
            tick={({ x, y, payload }: any) => {
              const d = data.find((item) => item.tier === payload.value)
              const colour = TIER_COLOUR[payload.value] ?? '#6b7280'
              return (
                <g>
                  <text x={x} y={y - 7} textAnchor="middle" dominantBaseline="central"
                    fontSize={13} fontWeight={700} fill={colour}>
                    {payload.value}
                  </text>
                  {d && (
                    <text x={x} y={y + 10} textAnchor="middle" dominantBaseline="central"
                      fontSize={11} fontWeight={500} fill={colour} opacity={0.75}>
                      {d.realPct}%
                    </text>
                  )}
                </g>
              )
            }}
          />
          <Tooltip content={<ChartTooltip />} />
          <Radar
            name="Role Requirement"
            dataKey="Role"
            stroke="#e2e8f0"
            fill="#e2e8f0"
            fillOpacity={0.5}
          />
          <Radar
            name="Your Coverage"
            dataKey="You"
            stroke="#3b82f6"
            fill="#3b82f6"
            fillOpacity={0.55}
            dot={{ r: 3, fill: '#3b82f6' }}
          />
          <Legend />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}
