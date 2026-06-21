from pydantic import BaseModel
from typing import Optional

class UploadResponse(BaseModel):
    session_id: str
    resume_text: str

class ExtractedSkill(BaseModel):
    name: str
    evidence: str
    confidence: str  # "High" | "Medium" | "Low"

class TieredSkill(BaseModel):
    name: str
    tier: str  # "Essential" | "Important" | "Nice-to-have"
    reasoning: str

class GapItem(BaseModel):
    skill: str
    tier: str
    action: str

class CoverageScore(BaseModel):
    essential: str    # e.g. "7/12"
    important: str
    nice_to_have: str

class AnalyseRequest(BaseModel):
    session_id: str
    resume_text: str
    target_role: Optional[str] = None  # None triggers auto-fit mode

class AnalyseResponse(BaseModel):
    session_id: str
    target_roles: list[str]
    user_skills: list[ExtractedSkill]
    tiered_role_skills: list[TieredSkill]
    coverage_score: CoverageScore
    gaps: list[GapItem]
    next_steps: list[str]

class RoleSearchResponse(BaseModel):
    roles: list[str]

class Milestone(BaseModel):
    description: str
    skill_focus: str

class CareerRung(BaseModel):
    role: str
    transferability_score: int  # 0–100
    skill_delta: list[str]
    why_good_fit: str
    milestones: list[Milestone]

class ProgressRequest(BaseModel):
    session_id: str
    current_role: str
    user_skill_names: list[str]

class ProgressResponse(BaseModel):
    current_role: str
    immediate_next: CareerRung
    full_ladder: list[CareerRung]
    long_term_destination: str
