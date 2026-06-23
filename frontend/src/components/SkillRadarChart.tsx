import {
  RadialBarChart,
  RadialBar,
  ResponsiveContainer,
  Tooltip,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Legend,
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

// ── sub-component: radial coverage bars ──────────────────────────────────────
function CoverageBars({ roleSkills }: { roleSkills: TieredSkill[] }) {
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

  const radialData = [
    { name: 'Nice-to-have', value: pct('Nice-to-have'), fill: TIER_COLOUR['Nice-to-have'] },
    { name: 'Important',    value: pct('Important'),    fill: TIER_COLOUR['Important'] },
    { name: 'Essential',    value: pct('Essential'),    fill: TIER_COLOUR['Essential'] },
  ]

  const totalHave  = Object.values(counts).reduce((a, c) => a + c.have, 0)
  const totalNeeds = Object.values(counts).reduce((a, c) => a + c.total, 0)
  const overall    = totalNeeds === 0 ? 0 : Math.round((totalHave / totalNeeds) * 100)

  return (
    <div className="flex items-center gap-6">
      {/* Radial ring chart */}
      <div className="relative shrink-0" style={{ width: 180, height: 180 }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            cx="50%" cy="50%"
            innerRadius="32%" outerRadius="92%"
            barSize={14}
            data={radialData}
            startAngle={90}
            endAngle={-270}
          >
            <RadialBar background dataKey="value" cornerRadius={6} />
            <Tooltip
              formatter={(value: number, name: string) => {
                const c = counts[name]
                return [`${c.have}/${c.total} skills (${value}%)`, name]
              }}
            />
          </RadialBarChart>
        </ResponsiveContainer>
        {/* centre label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-2xl font-bold text-gray-800">{overall}%</span>
          <span className="text-xs text-gray-400 leading-tight text-center">overall<br/>coverage</span>
        </div>
      </div>

      {/* Progress bars legend */}
      <div className="flex-1 space-y-3">
        {['Essential', 'Important', 'Nice-to-have'].map((tier) => {
          const { have, total } = counts[tier]
          const p = total === 0 ? 0 : Math.round((have / total) * 100)
          return (
            <div key={tier}>
              <div className="flex justify-between text-sm mb-1">
                <span className="font-medium" style={{ color: TIER_COLOUR[tier] }}>{tier}</span>
                <span className="text-gray-400 tabular-nums">{have}/{total} &nbsp;·&nbsp; {p}%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                  className="h-2 rounded-full transition-all duration-700"
                  style={{ width: `${p}%`, backgroundColor: TIER_COLOUR[tier] }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── sub-component: radar (kept, enhanced with tooltip) ───────────────────────
function SkillRadar({ roleSkills }: { roleSkills: TieredSkill[] }) {
  const data = roleSkills.map((s) => ({
    skill: s.name.length > 16 ? s.name.slice(0, 14) + '…' : s.name,
    fullName: s.name,
    Role: 100,
    You: s.matched_by && s.matched_by.length > 0 ? 100 : 0,
  }))

  return (
    <ResponsiveContainer width="100%" height={300}>
      <RadarChart data={data} outerRadius={110}>
        <PolarGrid />
        <PolarAngleAxis dataKey="skill" tick={{ fontSize: 11 }} />
        <Tooltip
          formatter={(val: number) => (val === 100 ? '✓ Have it' : '✗ Gap')}
          labelFormatter={(_label: string, payload: any[]) =>
            payload?.[0]?.payload?.fullName ?? _label
          }
        />
        <Radar
          name="Role Requirement"
          dataKey="Role"
          stroke="#e2e8f0"
          fill="#e2e8f0"
          fillOpacity={0.5}
        />
        <Radar
          name="Your Skills"
          dataKey="You"
          stroke="#3b82f6"
          fill="#3b82f6"
          fillOpacity={0.6}
        />
        <Legend />
      </RadarChart>
    </ResponsiveContainer>
  )
}

// ── main export ───────────────────────────────────────────────────────────────
export default function SkillRadarChart({ roleSkills }: Props) {
  return (
    <div className="bg-white border rounded-xl p-6 mb-6">
      <h2 className="font-semibold text-gray-700 mb-5">Coverage Overview</h2>

      {/* top: coverage bars */}
      <CoverageBars roleSkills={roleSkills} />

      {/* divider */}
      <hr className="my-5 border-gray-100" />

      {/* bottom: original radar, unchanged */}
      <p className="text-xs text-gray-400 mb-2 uppercase tracking-wide">Skill-by-skill breakdown</p>
      <SkillRadar roleSkills={roleSkills} />
    </div>
  )
}