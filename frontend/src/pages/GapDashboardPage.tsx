import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSessionStore } from '../store/useSessionStore'
import SkillCard from '../components/SkillCard'
import TieredSkillList from '../components/TieredSkillList'
import GapSummary from '../components/GapSummary'
import SkillRadarChart from '../components/SkillRadarChart'

export default function GapDashboardPage() {
  const navigate = useNavigate()
  const { analysisResult } = useSessionStore()

  useEffect(() => {
    if (!analysisResult) navigate('/')
  }, [analysisResult, navigate])

  if (!analysisResult) return null

  const { target_roles, user_skills, tiered_role_skills, coverage_score, gaps, next_steps } = analysisResult

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Skills Gap Analysis</h1>
          <p className="text-gray-500 text-sm mt-1">
            Target: <span className="font-medium text-gray-700">{target_roles[0]}</span>
            {target_roles.length > 1 && (
              <span className="text-gray-400"> (+{target_roles.length - 1} other matches)</span>
            )}
          </p>
        </div>
        <button
          onClick={() => navigate('/career-progression')}
          className="bg-blue-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          View Career Path →
        </button>
      </div>

      <div className="mb-8">
        <SkillRadarChart userSkills={user_skills} roleSkills={tiered_role_skills} />
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div>
          <h2 className="font-semibold mb-3 text-gray-700">
            Your Skills <span className="text-gray-400 font-normal">({user_skills.length})</span>
          </h2>
          {user_skills.map((s) => (
            <SkillCard key={s.name} skill={s} />
          ))}
        </div>
        <div>
          <h2 className="font-semibold mb-3 text-gray-700">Role Requirements</h2>
          <TieredSkillList skills={tiered_role_skills} />
        </div>
        <div>
          <h2 className="font-semibold mb-3 text-gray-700">Gap Summary</h2>
          <GapSummary score={coverage_score} gaps={gaps} nextSteps={next_steps} />
        </div>
      </div>
    </div>
  )
}
