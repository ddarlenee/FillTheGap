import type { CoverageScore, GapItem } from '../types'

const tierColour: Record<string, string> = {
  Essential: 'text-red-600',
  Important: 'text-amber-600',
  'Nice-to-have': 'text-green-600',
}

interface Props {
  score: CoverageScore
  gaps: GapItem[]
  nextSteps: string[]
}

export default function GapSummary({ score, gaps, nextSteps }: Props) {
  return (
    <div className="space-y-4">
      <div className="bg-white border rounded-xl p-4">
        <h3 className="font-semibold mb-3 text-gray-800">Coverage Score</h3>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-red-600 font-medium">Essential</span>
            <span className="font-mono">{score.essential}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-amber-600 font-medium">Important</span>
            <span className="font-mono">{score.important}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-green-600 font-medium">Nice-to-have</span>
            <span className="font-mono">{score.nice_to_have}</span>
          </div>
        </div>
      </div>

      <div className="bg-white border rounded-xl p-4">
        <h3 className="font-semibold mb-3 text-gray-800">Top Gaps to Close</h3>
        {gaps.length === 0 ? (
          <p className="text-sm text-gray-400">No gaps detected — great match!</p>
        ) : (
          <ul className="space-y-1">
            {gaps.slice(0, 6).map((g) => (
              <li key={g.skill} className="flex items-center gap-2 text-sm">
                <span className={`font-medium w-24 shrink-0 text-xs ${tierColour[g.tier] ?? 'text-gray-600'}`}>
                  {g.tier}
                </span>
                <span className="text-gray-700">{g.skill}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bg-white border rounded-xl p-4">
        <h3 className="font-semibold mb-3 text-gray-800">Next Steps</h3>
        <ol className="list-decimal list-inside space-y-2">
          {nextSteps.map((step, i) => (
            <li key={i} className="text-sm text-gray-700">{step}</li>
          ))}
        </ol>
      </div>
    </div>
  )
}
