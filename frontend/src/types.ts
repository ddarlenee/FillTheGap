export interface ExtractedSkill {
  name: string
  evidence: string
  confidence: 'High' | 'Medium' | 'Low'
}

export interface TieredSkill {
  name: string
  tier: 'Essential' | 'Important' | 'Nice-to-have'
  reasoning: string
  matched_by: string[]
}

export interface GapItem {
  skill: string
  tier: string
  action: string
}

export interface CoverageScore {
  essential: string
  important: string
  nice_to_have: string
}

export interface NextStepItem {
  summary?: string      // one-liner: action + platform (shown by default)
  text: string          // full detail (shown on expand)
  skill: string
  tier: string          // 'Essential' | 'Important' | 'Nice-to-have'
  completed?: boolean
}

export interface AnalyseResponse {
  target_roles: string[]
  user_skills: ExtractedSkill[]
  tiered_role_skills: TieredSkill[]
  coverage_score: CoverageScore
  gaps: GapItem[]
  next_steps: NextStepItem[]
}

export interface Milestone {
  description: string
  skill_focus: string
}

export interface CareerNextStep {
  skill: string
  action: string
  summary?: string
}

export interface CareerRung {
  role: string
  transferability_score: number
  skill_delta: string[]
  why_good_fit: string
  milestones: Milestone[]
  next_steps: CareerNextStep[]
}

export interface ProgressResponse {
  current_role: string
  immediate_next: CareerRung
  full_ladder: CareerRung[]
  long_term_destination: string
}
