-- Extends auth.users with display name
CREATE TABLE user_profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- One row per analysis run (replaces users.json "history" array entries)
CREATE TABLE analysis_history (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role                  TEXT NOT NULL,
  coverage              JSONB NOT NULL DEFAULT '{}',
  gaps                  JSONB NOT NULL DEFAULT '[]',
  next_steps            JSONB NOT NULL DEFAULT '[]',
  user_skills           JSONB NOT NULL DEFAULT '[]',
  transferability_score INTEGER,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX analysis_history_user_id_idx ON analysis_history(user_id);

-- Keyed by email, stores active session blob (replaces sessions/*.json)
CREATE TABLE sessions (
  session_id TEXT PRIMARY KEY,
  data       JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- LLM call audit log (replaces logs/*.jsonl); user_id nullable for pre-auth calls
CREATE TABLE interaction_logs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id TEXT,
  event      JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE interaction_logs ENABLE ROW LEVEL SECURITY;

-- Safety-net policies (backend uses service role key which bypasses these)
CREATE POLICY "users_own_profile" ON user_profiles
  FOR ALL USING (id = auth.uid());

CREATE POLICY "users_own_history" ON analysis_history
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "users_own_logs" ON interaction_logs
  FOR ALL USING (user_id = auth.uid());
