import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer, Legend } from 'recharts'
import type { ExtractedSkill, TieredSkill } from '../types'

interface Props {
  userSkills: ExtractedSkill[]
  roleSkills: TieredSkill[]
}

export default function SkillRadarChart({ userSkills, roleSkills }: Props) {
  const userNames = new Set(userSkills.map((s) => s.name.toLowerCase()))
  const data = roleSkills.slice(0, 8).map((s) => ({
    skill: s.name.length > 14 ? s.name.slice(0, 12) + '…' : s.name,
    Role: 100,
    You: userNames.has(s.name.toLowerCase()) ? 100 : 0,
  }))

  return (
    <ResponsiveContainer width="100%" height={280}>
      <RadarChart data={data}>
        <PolarGrid />
        <PolarAngleAxis dataKey="skill" tick={{ fontSize: 11 }} />
        <Radar name="Role Requirement" dataKey="Role" stroke="#e2e8f0" fill="#e2e8f0" fillOpacity={0.5} />
        <Radar name="Your Skills" dataKey="You" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
        <Legend />
      </RadarChart>
    </ResponsiveContainer>
  )
}
