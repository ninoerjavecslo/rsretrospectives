export interface Project {
  id: string;
  name: string;
  client: string;
  project_type: string;
  cms: string;
  integrations: string;
  offer_value: number;
  estimated_profit_margin: number;
  went_well: string;
  went_wrong: string;
  scope_creep: boolean;
  scope_creep_notes: string;
  status: 'draft' | 'active' | 'completed';
  created_at: string;
  updated_at: string;
}

export interface ProfileHours {
  id: string;
  project_id: string;
  profile: Profile;
  estimated_hours: number;
  actual_hours: number;
}

export interface ScopeItem {
  id: string;
  project_id: string;
  name: string;
  type: ScopeItemType;
  planned_count: number;
  actual_count: number;
  notes: string;
}

export interface ExternalCost {
  id: string;
  project_id: string;
  description: string;
  estimated_cost: number;
  actual_cost: number;
  notes: string;
}

export interface ChangeRequest {
  id: string;
  project_id: string;
  description: string;
  amount: number;
  created_at: string;
}

export type Profile = 'UX' | 'UI' | 'DEV' | 'PM' | 'CONTENT' | 'ANALYTICS';

export type ScopeItemType = 'Wireframe' | 'Component' | 'Page' | 'Template' | 'Integration' | 'Content' | 'Custom';

export const PROFILES: Profile[] = ['UX', 'UI', 'DEV', 'PM', 'CONTENT', 'ANALYTICS'];

export const SCOPE_ITEM_TYPES: ScopeItemType[] = ['Wireframe', 'Component', 'Page', 'Template', 'Integration', 'Content', 'Custom'];

export interface ProjectWithDetails extends Project {
  profile_hours: ProfileHours[];
  scope_items: ScopeItem[];
  external_costs: ExternalCost[];
  change_requests: ChangeRequest[];
}

// Calculated metrics
export interface ProjectMetrics {
  totalValue: number;
  estimatedHours: number;
  actualHours: number;
  hoursVariance: number;
  hoursVariancePercent: number;
  estimatedExternalCost: number;
  actualExternalCost: number;
  estimatedTotalCost: number;
  actualTotalCost: number;
  estimatedProfit: number;
  actualProfit: number;
  estimatedMargin: number;
  actualMargin: number;
  marginDelta: number;
  health: 'on-track' | 'at-risk' | 'over-budget';
}
