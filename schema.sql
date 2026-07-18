-- Run this once against your Neon database to set up the schema.

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_id TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS job_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  short_id TEXT NOT NULL,
  company TEXT NOT NULL,
  role TEXT NOT NULL,
  level TEXT,
  geography TEXT,
  jd_text TEXT NOT NULL,
  plan_gist TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, short_id)
);

CREATE TABLE IF NOT EXISTS interview_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_application_id UUID REFERENCES job_applications(id) ON DELETE CASCADE,
  round_type TEXT NOT NULL,
  order_index INTEGER,
  status TEXT DEFAULT 'not_attempted',
  confidence_score INTEGER,
  estimated_duration_minutes INTEGER,
  question_count INTEGER,
  depth_calibration_rationale TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS question_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID REFERENCES interview_rounds(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  questions JSONB NOT NULL,
  difficulty_profile JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS round_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID REFERENCES interview_rounds(id) ON DELETE CASCADE,
  question_set_id UUID REFERENCES question_sets(id),
  confidence_score INTEGER,
  status TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS question_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_attempt_id UUID REFERENCES round_attempts(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL,
  user_answer TEXT,
  strong_points JSONB,
  missed_points JSONB,
  interviewer_expectation TEXT,
  follow_up_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
