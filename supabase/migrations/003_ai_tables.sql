-- AI Features Migration
-- Run this in Supabase SQL Editor

-- Add brief_url to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS brief_url text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS brief_text text;

-- AI Conversations (Chat history)
CREATE TABLE IF NOT EXISTS ai_conversations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  title text,
  messages jsonb DEFAULT '[]'
);

ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on ai_conversations" ON ai_conversations FOR ALL USING (true);

-- AI Estimates (Estimator history)
CREATE TABLE IF NOT EXISTS ai_estimates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  -- Input
  brief_text text,
  project_type text,
  cms text,
  integrations text,
  scope_items jsonb,
  -- AI Output
  estimate_result jsonb,
  suggested_price numeric,
  confidence text,
  risks jsonb,
  similar_projects jsonb,
  -- Feedback/Learning
  user_feedback text CHECK (user_feedback IN ('good', 'bad', 'neutral')),
  feedback_notes text,
  actual_project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  accuracy_notes text
);

ALTER TABLE ai_estimates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on ai_estimates" ON ai_estimates FOR ALL USING (true);

-- AI Feedback (Response-level feedback for learning)
CREATE TABLE IF NOT EXISTS ai_feedback (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  conversation_id uuid REFERENCES ai_conversations(id) ON DELETE CASCADE,
  message_index int,
  rating text CHECK (rating IN ('good', 'bad', 'corrected')),
  correction text,
  notes text
);

ALTER TABLE ai_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on ai_feedback" ON ai_feedback FOR ALL USING (true);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_ai_estimates_project ON ai_estimates(actual_project_id);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_conversation ON ai_feedback(conversation_id);
