from models.schemas import ExtractedSkill, TieredSkill, GapItem, CoverageScore

def analyse_gaps(
    user_skills: list[ExtractedSkill],
    tiered_role_skills: list[TieredSkill],
) -> tuple[list[GapItem], CoverageScore]:
    user_skill_names = {s.name.lower() for s in user_skills}
    gaps: list[GapItem] = []
    counts = {"Essential": [0, 0], "Important": [0, 0], "Nice-to-have": [0, 0]}

    for ts in tiered_role_skills:
        tier = ts.tier
        counts[tier][1] += 1
        if ts.name.lower() in user_skill_names:
            counts[tier][0] += 1
        else:
            gaps.append(GapItem(skill=ts.name, tier=tier, action=""))

    score = CoverageScore(
        essential=f"{counts['Essential'][0]}/{counts['Essential'][1]}",
        important=f"{counts['Important'][0]}/{counts['Important'][1]}",
        nice_to_have=f"{counts['Nice-to-have'][0]}/{counts['Nice-to-have'][1]}",
    )
    tier_order = {"Essential": 0, "Important": 1, "Nice-to-have": 2}
    gaps.sort(key=lambda g: tier_order.get(g.tier, 3))
    return gaps, score
