import pandas as pd
from pathlib import Path
import logging
from config import settings

logger = logging.getLogger(__name__)

DEMO_DATA: dict[str, list[str]] = {
    "Data Analyst": [
        "Data Visualisation", "SQL", "Python", "Statistical Analysis",
        "Business Intelligence Tools", "Data Storytelling", "Excel",
        "Communication", "Problem Solving", "Data Governance",
    ],
    "Senior Data Analyst": [
        "Data Visualisation", "SQL", "Python", "Statistical Analysis",
        "Machine Learning Fundamentals", "Data Strategy", "Stakeholder Management",
        "Team Leadership", "Data Governance", "Communication",
    ],
    "Data Engineer": [
        "Python", "SQL", "ETL Pipeline Design", "Apache Spark", "Cloud Platforms",
        "Data Modelling", "Database Administration", "Data Quality Management",
        "DevOps Fundamentals", "Communication",
    ],
    "Software Engineer": [
        "Python", "Software Architecture", "Version Control (Git)",
        "Testing and Quality Assurance", "API Design", "Cloud Deployment",
        "Agile Methodologies", "Communication", "Problem Solving",
    ],
    "Product Manager": [
        "Product Strategy", "User Research", "Data Analysis", "Agile Methodologies",
        "Stakeholder Management", "Communication", "Roadmap Planning",
        "Market Analysis", "Problem Solving", "Business Acumen",
    ],
    "UX Designer": [
        "User Research", "Wireframing", "Prototyping", "Usability Testing",
        "Information Architecture", "Visual Design", "Communication",
        "Problem Solving", "Figma", "Accessibility Design",
    ],
    "Machine Learning Engineer": [
        "Python", "Machine Learning", "Deep Learning", "MLOps", "Cloud Platforms",
        "Feature Engineering", "Model Evaluation", "SQL", "Statistics",
        "Communication",
    ],
}

class SkillsFutureLoader:
    def __init__(self):
        self._role_index: dict[str, list[str]] = {}
        self._all_roles: list[str] = []

    def load(self):
        data_dir = Path(settings.skillsfuture_data_dir)
        if not data_dir.exists() or not list(data_dir.glob("*.xlsx")):
            logger.warning("No SkillsFuture Excel files found — using demo data")
            self.seed_demo_data()
            return
        for xlsx_file in data_dir.glob("*.xlsx"):
            self._load_file(xlsx_file)
        if not self._role_index:
            logger.warning("Excel files found but no roles extracted — using demo data")
            self.seed_demo_data()
        self._all_roles = sorted(self._role_index.keys())
        logger.info(f"Loaded {len(self._all_roles)} roles from SkillsFuture data")

    def seed_demo_data(self):
        self._role_index = {k: list(v) for k, v in DEMO_DATA.items()}
        self._all_roles = sorted(self._role_index.keys())

    def _load_file(self, path: Path):
        try:
            xl = pd.ExcelFile(path)
            for sheet_name in xl.sheet_names:
                df = pd.read_excel(path, sheet_name=sheet_name, header=None)
                self._extract_pairs(df.fillna("").astype(str))
        except Exception as e:
            logger.error(f"Failed to load {path.name}: {e}")

    def _extract_pairs(self, df: pd.DataFrame):
        role_keywords = {"job role", "role title", "occupation", "job title"}
        for col_idx in range(len(df.columns)):
            header = df.iloc[0, col_idx].lower()
            if any(kw in header for kw in role_keywords):
                skill_col = col_idx + 1
                if skill_col >= len(df.columns):
                    continue
                for _, row in df.iloc[1:].iterrows():
                    role = row.iloc[col_idx].strip()
                    skill = row.iloc[skill_col].strip()
                    if role and skill:
                        self._role_index.setdefault(role, [])
                        if skill not in self._role_index[role]:
                            self._role_index[role].append(skill)
                break

    def get_roles(self, query: str = "") -> list[str]:
        if not query:
            return self._all_roles
        q = query.lower()
        return [r for r in self._all_roles if q in r.lower()]

    def get_skills_for_role(self, role: str) -> list[str]:
        return self._role_index.get(role, [])

skillsfuture = SkillsFutureLoader()
