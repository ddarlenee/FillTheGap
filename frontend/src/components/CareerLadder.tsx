import type { CareerRung } from '../types'
import MilestoneChips from './MilestoneChips'

interface Props {
  currentRole: string
  immediateNext: CareerRung
  fullLadder: CareerRung[]
  longTermDestination: string
}

export default function CareerLadder({ currentRole, immediateNext, fullLadder, longTermDestination }: Props) {
  return (
    <div className="relative pl-8 border-l-2 border-blue-200">

      {/* Long-term north star */}
      <div className="mb-8 opacity-40">
        <div className="absolute -left-2.5 w-4 h-4 rounded-full bg-purple-300 border-2 border-white" />
        <p className="text-xs uppercase tracking-wide text-purple-500 font-semibold ml-4">Long-term goal</p>
        <p className="text-base font-bold text-purple-400 ml-4">{longTermDestination}</p>
      </div>

      {/* Distant future roles — faint */}
      {[...fullLadder].reverse().map((rung) => (
        <div key={rung.role} className="mb-8 group">
          <div className="absolute -left-2 w-4 h-4 rounded-full bg-gray-300 border-2 border-white" />
          <div className="ml-4 opacity-50 group-hover:opacity-80 transition-opacity">
            <p className="text-sm font-semibold text-gray-500">{rung.role}</p>
            <p className="text-xs text-gray-400">{rung.transferability_score}% transferable</p>
          </div>
          {/* Tooltip on hover */}
          <div className="ml-4 mt-1 hidden group-hover:block bg-white border shadow-md rounded-lg p-3 text-xs max-w-xs">
            <p className="font-medium text-gray-700 mb-1">{rung.why_good_fit}</p>
            {rung.skill_delta.length > 0 && (
              <p className="text-gray-500">
                New skills needed: {rung.skill_delta.slice(0, 3).join(', ')}
                {rung.skill_delta.length > 3 && ' …'}
              </p>
            )}
          </div>
        </div>
      ))}

      {/* Immediate next role — primary CTA */}
      <div className="mb-8 bg-blue-50 border-2 border-blue-400 rounded-xl p-5">
        <div className="absolute -left-3 w-5 h-5 rounded-full bg-blue-500 border-2 border-white" />
        <p className="text-xs text-blue-500 font-semibold uppercase tracking-wide mb-1">Your Next Step</p>
        <p className="text-xl font-bold text-blue-800 mb-1">{immediateNext.role}</p>
        <p className="text-sm text-blue-600">{immediateNext.transferability_score}% of your current skills transfer</p>
        <p className="text-sm text-gray-600 mt-2 italic">"{immediateNext.why_good_fit}"</p>

        {immediateNext.skill_delta.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-semibold text-gray-500 mb-1">New skills you'll need:</p>
            <div className="flex flex-wrap gap-1">
              {immediateNext.skill_delta.map((s) => (
                <span key={s} className="bg-white border border-blue-200 text-blue-700 text-xs px-2 py-0.5 rounded">
                  {s}
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
