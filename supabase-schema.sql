-- Agency Retrospective Tool - Supabase Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Projects table
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  client TEXT DEFAULT '',
  project_type TEXT DEFAULT '',
  cms TEXT DEFAULT '',
  integrations TEXT DEFAULT '',
  offer_value NUMERIC DEFAULT 0,
  estimated_profit_margin NUMERIC DEFAULT 30,
  went_well TEXT DEFAULT '',
  went_wrong TEXT DEFAULT '',
  scope_creep BOOLEAN DEFAULT false,
  scope_creep_notes TEXT DEFAULT '',
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Profile Hours table (hours by role per project)
CREATE TABLE profile_hours (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  profile TEXT NOT NULL CHECK (profile IN ('UX', 'UI', 'DEV', 'PM', 'CONTENT', 'ANALYTICS')),
  estimated_hours NUMERIC DEFAULT 0,
  actual_hours NUMERIC DEFAULT 0,
  UNIQUE(project_id, profile)
);

-- Scope Items table (deliverables like wireframes, components, pages)
CREATE TABLE scope_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'Custom' CHECK (type IN ('Wireframe', 'Component', 'Page', 'Template', 'Integration', 'Custom')),
  planned_count NUMERIC DEFAULT 0,
  actual_count NUMERIC DEFAULT 0,
  notes TEXT DEFAULT ''
);

-- External Costs table
CREATE TABLE external_costs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  estimated_cost NUMERIC DEFAULT 0,
  actual_cost NUMERIC DEFAULT 0,
  notes TEXT DEFAULT ''
);

-- Change Requests table
CREATE TABLE change_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_profile_hours_project ON profile_hours(project_id);
CREATE INDEX idx_scope_items_project ON scope_items(project_id);
CREATE INDEX idx_external_costs_project ON external_costs(project_id);
CREATE INDEX idx_change_requests_project ON change_requests(project_id);
CREATE INDEX idx_projects_status ON projects(status);

-- Disable RLS for internal tool (no auth)
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE scope_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE change_requests ENABLE ROW LEVEL SECURITY;

-- Allow all operations (internal tool, no auth)
CREATE POLICY "Allow all operations on projects" ON projects FOR ALL USING (true);
CREATE POLICY "Allow all operations on profile_hours" ON profile_hours FOR ALL USING (true);
CREATE POLICY "Allow all operations on scope_items" ON scope_items FOR ALL USING (true);
CREATE POLICY "Allow all operations on external_costs" ON external_costs FOR ALL USING (true);
CREATE POLICY "Allow all operations on change_requests" ON change_requests FOR ALL USING (true);

-- Sample data for testing
INSERT INTO projects (name, client, project_type, cms, integrations, offer_value, estimated_profit_margin, went_well, went_wrong, scope_creep, scope_creep_notes, status)
VALUES 
  ('Hisense Intranet', 'Hisense Europe', 'Intranet', 'SharePoint', 'Azure AD, Power Automate, Teams', 45000, 35, 'Good client communication. Design approved quickly.', 'Requirements changed mid-project. Azure AD integration more complex than expected.', true, 'Client added advanced search filters and additional document library mid-project.', 'active'),
  ('Sava Hotels Redesign', 'Sava Hotels', 'Website', 'Statamic', 'Booking API, Analytics', 28000, 40, 'Smooth development process. Client was responsive.', 'Initial design took longer than expected.', false, '', 'completed'),
  ('Kontron CMS Migration', 'Kontron', 'CMS', 'Payload', 'REST API, CDN', 18000, 30, 'Technical migration went smoothly.', 'Content migration had more edge cases than anticipated.', true, 'Additional content types discovered during migration.', 'active');

-- Add sample profile hours
INSERT INTO profile_hours (project_id, profile, estimated_hours, actual_hours)
SELECT id, 'UX', 40, 45 FROM projects WHERE name = 'Hisense Intranet'
UNION ALL
SELECT id, 'UI', 60, 70 FROM projects WHERE name = 'Hisense Intranet'
UNION ALL
SELECT id, 'DEV', 140, 180 FROM projects WHERE name = 'Hisense Intranet'
UNION ALL
SELECT id, 'PM', 40, 50 FROM projects WHERE name = 'Hisense Intranet'
UNION ALL
SELECT id, 'CONTENT', 20, 20 FROM projects WHERE name = 'Hisense Intranet'
UNION ALL
SELECT id, 'ANALYTICS', 20, 20 FROM projects WHERE name = 'Hisense Intranet';

INSERT INTO profile_hours (project_id, profile, estimated_hours, actual_hours)
SELECT id, 'UX', 30, 28 FROM projects WHERE name = 'Sava Hotels Redesign'
UNION ALL
SELECT id, 'UI', 50, 55 FROM projects WHERE name = 'Sava Hotels Redesign'
UNION ALL
SELECT id, 'DEV', 80, 75 FROM projects WHERE name = 'Sava Hotels Redesign'
UNION ALL
SELECT id, 'PM', 25, 22 FROM projects WHERE name = 'Sava Hotels Redesign'
UNION ALL
SELECT id, 'CONTENT', 15, 15 FROM projects WHERE name = 'Sava Hotels Redesign';

-- Add sample scope items
INSERT INTO scope_items (project_id, name, type, planned_count, actual_count, notes)
SELECT id, 'Wireframes', 'Wireframe', 10, 12, '2 extra for revised navigation' FROM projects WHERE name = 'Hisense Intranet'
UNION ALL
SELECT id, 'UI Components', 'Component', 30, 35, 'Additional variants requested' FROM projects WHERE name = 'Hisense Intranet'
UNION ALL
SELECT id, 'Pages', 'Page', 8, 10, '2 additional document views' FROM projects WHERE name = 'Hisense Intranet'
UNION ALL
SELECT id, 'SPFx Webparts', 'Integration', 5, 6, 'Extra search webpart' FROM projects WHERE name = 'Hisense Intranet';

INSERT INTO scope_items (project_id, name, type, planned_count, actual_count, notes)
SELECT id, 'Wireframes', 'Wireframe', 8, 8, '' FROM projects WHERE name = 'Sava Hotels Redesign'
UNION ALL
SELECT id, 'Page Templates', 'Template', 12, 12, '' FROM projects WHERE name = 'Sava Hotels Redesign'
UNION ALL
SELECT id, 'Components', 'Component', 25, 24, 'Combined 2 similar components' FROM projects WHERE name = 'Sava Hotels Redesign';

-- Add sample change requests
INSERT INTO change_requests (project_id, description, amount)
SELECT id, 'Advanced search filters', 4500 FROM projects WHERE name = 'Hisense Intranet'
UNION ALL
SELECT id, 'Additional document library', 2500 FROM projects WHERE name = 'Hisense Intranet';

-- Add sample external costs
INSERT INTO external_costs (project_id, description, estimated_cost, actual_cost, notes)
SELECT id, 'Azure consultant (2 days)', 1600, 2400, 'Extended engagement' FROM projects WHERE name = 'Hisense Intranet'
UNION ALL
SELECT id, 'Stock photography', 200, 180, '' FROM projects WHERE name = 'Hisense Intranet';
