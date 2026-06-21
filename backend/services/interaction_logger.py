import json
from datetime import datetime, timezone
from pathlib import Path
from config import settings

def log_interaction(session_id: str, call_type: str, prompt: str, response: str) -> None:
    log_dir = Path(settings.log_dir)
    log_dir.mkdir(exist_ok=True)
    entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "session_id": session_id,
        "type": call_type,
        "model": "gpt-4o",
        "prompt": prompt,
        "response": response,
    }
    log_path = log_dir / f"{session_id}.jsonl"
    with open(log_path, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry) + "\n")
