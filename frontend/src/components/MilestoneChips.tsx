import type { Milestone } from '../types'

export default function MilestoneChips({ milestones }: { milestones: Milestone[] }) {
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {milestones.map((m, i) => (
        <div key={i} className="group relative">
          <span className="bg-blue-100 text-blue-700 text-xs px-3 py-1 rounded-full cursor-pointer hover:bg-blue-200 font-medium">
            {m.description.length > 40 ? m.description.slice(0, 38) + '…' : m.description}
          </span>
          <div className="absolute bottom-full left-0 mb-1 hidden group-hover:block bg-gray-800 text-white text-xs rounded px-2 py-1 w-52 z-10 shadow-lg">
            <p>{m.description}</p>
            <p className="text-gray-300 mt-1">Focus: {m.skill_focus}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
