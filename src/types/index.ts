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
  project_outcome: ProjectOutcome | null;
  brief_url: string | null;
  brief_text: string | null;
  created_at: string;
  updated_at: string;
}

export type ProjectOutcome = 'success' | 'partial_success' | 'failure' | 'worth_repeating' | 'not_worth_repeating';

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
  cost_type: CostType;
  estimated_cost: number;
  actual_cost: number;
  notes: string;
}

export type CostType = 'contractor' | 'tool_license';

export interface ChangeRequest {
  id: string;
  project_id: string;
  description: string;
  amount: number;
  created_at: string;
  hours?: ChangeRequestHours[];
}

export interface ChangeRequestHours {
  id: string;
  change_request_id: string;
  profile: Profile;
  actual_hours: number;
}

export type Profile = 'UX' | 'UI' | 'DESIGN' | 'DEV' | 'PM' | 'CONTENT' | 'ANALYTICS';

export type ScopeItemType = 'Wireframe' | 'Component' | 'Page' | 'Template' | 'Integration' | 'Content' | 'Custom';

export const PROFILES: Profile[] = ['UX', 'UI', 'DESIGN', 'DEV', 'PM', 'CONTENT', 'ANALYTICS'];

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
  estimatedHourlyRate: number;
  actualHourlyRate: number;
  health: 'on-track' | 'at-risk' | 'over-budget';
}

// AI Types
export interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

export interface AIConversation {
  id: string;
  created_at: string;
  updated_at: string;
  title: string | null;
  messages: AIMessage[];
}

export interface AIEstimateInput {
  brief_text: string;
  project_type: string;
  cms: string;
  integrations: string;
  scope_items: {
    pages?: number;
    components?: number;
    templates?: number;
    integrations?: number;
    wireframes?: number;
  };
}

export interface AIEstimateResult {
  profiles: {
    [key in Profile]?: {
      optimistic: number;
      realistic: number;
      pessimistic: number;
    };
  };
  total: {
    optimistic: number;
    realistic: number;
    pessimistic: number;
  };
}

export interface AIEstimate {
  id: string;
  created_at: string;
  brief_text: string | null;
  project_type: string | null;
  cms: string | null;
  integrations: string | null;
  scope_items: AIEstimateInput['scope_items'] | null;
  estimate_result: AIEstimateResult | null;
  suggested_price: number | null;
  confidence: 'low' | 'medium' | 'high' | null;
  risks: string[] | null;
  similar_projects: { id: string; name: string; similarity: number }[] | null;
  user_feedback: 'good' | 'bad' | 'neutral' | null;
  feedback_notes: string | null;
  actual_project_id: string | null;
  accuracy_notes: string | null;
}

export interface AIFeedback {
  id: string;
  created_at: string;
  conversation_id: string;
  message_index: number;
  rating: 'good' | 'bad' | 'corrected';
  correction: string | null;
  notes: string | null;
}
