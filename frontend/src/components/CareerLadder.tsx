import type { CareerRung } from '../types'
import MilestoneChips from './MilestoneChips'

interface Props {
  currentRole: string
  immediateNext: CareerRung
  fullLadder: CareerRung[]
  longTermDestination: string
  onStartNow?: (role: string) => void
  startingRole?: string | null
}

function StartNowButton({ role, onStartNow, startingRole, size = 'md' }: {
  role: string
  onStartNow: (role: string) => void
  startingRole?: string | null
  size?: 'sm' | 'md'
}) {
  const isThis = startingRole === role
  const isAny = startingRole !== null && startingRole !== undefined

  return (
    <button
      onClick={() => { if (!isAny) onStartNow(role) }}
      disabled={isAny}
      className={`inline-flex items-center gap-1.5 font-semibold rounded-lg transition-colors ${
        size === 'md' ? 'px-4 py-2 text-sm' : 'px-2.5 py-1 text-xs'
      } ${
        isThis
          ? 'bg-blue-200 text-blue-500 cursor-wait'
          : isAny
          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
          : size === 'md'
          ? 'bg-blue-600 hover:bg-blue-700 text-white'
          : 'bg-white hover:bg-blue-50 text-blue-600 border border-blue-300'
      }`}
    >
      {isThis ? (
        <>
          <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
          </svg>
          Analysing…
        </>
      ) : (
        <>
          Start now
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5-5 5M6 12h12" />
          </svg>
        </>
      )}
    </button>
  )
}

export default function CareerLadder({ currentRole, immediateNext, fullLadder, longTermDestination, onStartNow, startingRole }: Props) {
  return (
    <div className="relative pl-8 border-l-2 border-blue-200">

      {/* Long-term north star */}
      <div className="mb-8 opacity-40">
        <div className="absolute -left-2.5 w-4 h-4 rounded-full bg-purple-300 border-2 border-white" />
        <p className="text-xs uppercase tracking-wide text-purple-500 font-semibold ml-4">Long-term goal</p>
        <p className="text-base font-bold text-purple-400 ml-4">{longTermDestination}</p>
      </div>

      {/* Future roles — informational on hover */}
      {[...fullLadder].reverse().map((rung) => (
        <div key={rung.role} className="mb-8 group">
          <div className="absolute -left-2 w-4 h-4 rounded-full bg-gray-300 border-2 border-white" />
          <div className="ml-4">
            <div className="flex items-center gap-3 opacity-50 group-hover:opacity-90 transition-opacity">
              <div>
                <p className="text-sm font-semibold text-gray-500">{rung.role}</p>
                <p className="text-xs text-gray-400">{rung.transferability_score}% transferable</p>
              </div>
              {onStartNow && (
                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <StartNowButton role={rung.role} onStartNow={onStartNow} startingRole={startingRole} size="sm" />
                </div>
              )}
            </div>
            <div className="mt-1 hidden group-hover:block bg-white border shadow-md rounded-lg p-3 text-xs max-w-xs">
              <p className="font-medium text-gray-700 mb-1">{rung.why_good_fit}</p>
              {rung.skill_delta.length > 0 && (
                <p className="text-gray-500">
                  New skills needed: {rung.skill_delta.slice(0, 3).join(', ')}
                  {rung.skill_delta.length > 3 && ' …'}
                </p>
              )}
            </div>
          </div>
        </div>
      ))}

      {/* Immediate next role — skill delta as info chips, Start now always enabled */}
      <div className="mb-8 bg-blue-50 border-2 border-blue-400 rounded-xl p-5">
        <div className="absolute -left-3 w-5 h-5 rounded-full bg-blue-500 border-2 border-white" />
        <p className="text-xs text-blue-500 font-semibold uppercase tracking-wide mb-1">Your Next Step</p>
        <p className="text-xl font-bold text-blue-800 mb-1">{immediateNext.role}</p>
        <p className="text-sm text-blue-600">{immediateNext.transferability_score}% of your current skills transfer</p>
        <p className="text-sm text-gray-600 mt-2 italic">"{immediateNext.why_good_fit}"</p>

        {immediateNext.skill_delta.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-semibold text-gray-500 mb-2">New skills you'll need to learn:</p>
            <div className="flex flex-wrap gap-1.5">
              {immediateNext.skill_delta.map((skill) => (
                <span
                  key={skill}
                  className="bg-white border border-blue-300 text-blue-700 text-xs font-medium px-2.5 py-1 rounded-full"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}

        {immediateNext.milestones.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-semibold text-gray-500 mb-1">Milestones to get there:</p>
            <MilestoneChips milestones={immediateNext.milestones} />
          </div>
        )}

        {onStartNow && (
          <div className="mt-4">
            <StartNowButton
              role={immediateNext.role}
              onStartNow={onStartNow}
              startingRole={startingRole}
              size="md"
            />
            <p className="text-xs text-gray-400 mt-2">
              Starts your gap analysis for this role — track your progress in History.
            </p>
          </div>
        )}
      </div>

      {/* Current role */}
      <div className="mb-2">
        <div className="absolute -left-2 w-4 h-4 rounded-full bg-green-500 border-2 border-white" />
        <div className="ml-4">
          <p className="text-xs text-green-600 font-semibold uppercase tracking-wide">You are here</p>
          <p className="text-base font-bold text-gray-700">{currentRole}</p>
        </div>
      </div>

    </div>
  )
}
