import { createClient } from '@supabase/supabase-js';
import type { Project, ProfileHours, ScopeItem, ExternalCost, ChangeRequest, ChangeRequestHours, ProjectWithDetails, ProjectMetrics } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseKey);

// Internal hourly cost for calculations (configurable)
export const INTERNAL_HOURLY_COST = 30;

// Target margin range for project success (50-55%)
export const TARGET_MARGIN_MIN = 50;
export const TARGET_MARGIN_MAX = 55;

// Calculate project metrics
export function calculateMetrics(project: ProjectWithDetails): ProjectMetrics {
  const changeRequestsTotal = project.change_requests?.reduce((sum, cr) => sum + cr.amount, 0) || 0;
  const totalValue = project.offer_value + changeRequestsTotal;

  const estimatedHours = project.profile_hours?.reduce((sum, ph) => sum + ph.estimated_hours, 0) || 0;
  const baseActualHours = project.profile_hours?.reduce((sum, ph) => sum + ph.actual_hours, 0) || 0;

  // Add CR hours to actual hours total
  const crHours = project.change_requests?.reduce((sum, cr) =>
    sum + (cr.hours?.reduce((s, h) => s + h.actual_hours, 0) || 0), 0) || 0;
  const actualHours = baseActualHours + crHours;

  const hoursVariance = actualHours - estimatedHours;
  const hoursVariancePercent = estimatedHours > 0 ? (hoursVariance / estimatedHours) * 100 : 0;

  const estimatedExternalCost = project.external_costs?.reduce((sum, ec) => sum + ec.estimated_cost, 0) || 0;
  const actualExternalCost = project.external_costs?.reduce((sum, ec) => sum + ec.actual_cost, 0) || 0;

  const estimatedInternalCost = estimatedHours * INTERNAL_HOURLY_COST;
  const actualInternalCost = actualHours * INTERNAL_HOURLY_COST;

  const estimatedTotalCost = estimatedInternalCost + estimatedExternalCost;
  const actualTotalCost = actualInternalCost + actualExternalCost;

  const estimatedProfit = totalValue - estimatedTotalCost;
  const actualProfit = totalValue - actualTotalCost;

  const estimatedMargin = totalValue > 0 ? (estimatedProfit / totalValue) * 100 : 0;
  const actualMargin = totalValue > 0 ? (actualProfit / totalValue) * 100 : 0;
  const marginDelta = actualMargin - estimatedMargin;

  // Effective hourly rates (what you earn per hour after external costs)
  const netValueForHours = totalValue - estimatedExternalCost;
  const estimatedHourlyRate = estimatedHours > 0 ? netValueForHours / estimatedHours : 0;
  const actualHourlyRate = actualHours > 0 ? (totalValue - actualExternalCost) / actualHours : 0;

  // Determine health based on actual margin target (50-55%)
  let health: 'on-track' | 'at-risk' | 'over-budget' = 'on-track';
  if (actualHours > 0) {
    // Only evaluate health for projects with logged hours
    if (actualMargin >= TARGET_MARGIN_MIN && actualMargin <= TARGET_MARGIN_MAX) {
      health = 'on-track'; // Hit the target range
    } else if (actualMargin >= TARGET_MARGIN_MIN - 5 && actualMargin < TARGET_MARGIN_MIN) {
      health = 'at-risk'; // Close to target but below (45-50%)
    } else if (actualMargin > TARGET_MARGIN_MAX && actualMargin <= TARGET_MARGIN_MAX + 10) {
      health = 'on-track'; // Above target is also good (55-65%)
    } else if (actualMargin < TARGET_MARGIN_MIN - 5) {
      health = 'over-budget'; // Below 45% margin
    } else {
      health = 'on-track'; // Very high margin (>65%) is fine
    }
  }

  return {
    totalValue,
    estimatedHours,
    actualHours,
    hoursVariance,
    hoursVariancePercent,
    estimatedExternalCost,
    actualExternalCost,
    estimatedTotalCost,
    actualTotalCost,
    estimatedProfit,
    actualProfit,
    estimatedMargin,
    actualMargin,
    marginDelta,
    estimatedHourlyRate,
    actualHourlyRate,
    health,
  };
}

// Fetch all projects with basic info
export async function fetchProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

// Fetch single project with all related data
export async function fetchProjectWithDetails(id: string): Promise<ProjectWithDetails | null> {
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single();

  if (projectError) throw projectError;
  if (!project) return null;

  const [
    { data: profile_hours },
    { data: scope_items },
    { data: external_costs },
    { data: change_requests },
  ] = await Promise.all([
    supabase.from('profile_hours').select('*').eq('project_id', id),
    supabase.from('scope_items').select('*').eq('project_id', id),
    supabase.from('external_costs').select('*').eq('project_id', id),
    supabase.from('change_requests').select('*').eq('project_id', id).order('created_at', { ascending: true }),
  ]);

  // Fetch CR hours for each change request
  const crIds = (change_requests || []).map((cr: ChangeRequest) => cr.id);
  let crHoursMap: Record<string, ChangeRequestHours[]> = {};

  if (crIds.length > 0) {
    const { data: cr_hours } = await supabase
      .from('change_request_hours')
      .select('*')
      .in('change_request_id', crIds);

    for (const crh of cr_hours || []) {
      if (!crHoursMap[crh.change_request_id]) {
        crHoursMap[crh.change_request_id] = [];
      }
      crHoursMap[crh.change_request_id].push(crh);
    }
  }

  const changeRequestsWithHours = (change_requests || []).map((cr: ChangeRequest) => ({
    ...cr,
    hours: crHoursMap[cr.id] || [],
  }));

  return {
    ...project,
    profile_hours: profile_hours || [],
    scope_items: scope_items || [],
    external_costs: external_costs || [],
    change_requests: changeRequestsWithHours,
  };
}

// Create a new project
export async function createProject(project: Partial<Project>): Promise<Project> {
  const { data, error } = await supabase
    .from('projects')
    .insert([{
      name: project.name || 'New Project',
      client: project.client || '',
      project_type: project.project_type || '',
      cms: project.cms || '',
      integrations: project.integrations || '',
      offer_value: project.offer_value || 0,
      estimated_profit_margin: project.estimated_profit_margin || 30,
      went_well: '',
      went_wrong: '',
      scope_creep: false,
      scope_creep_notes: '',
      status: 'draft',
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Update project
export async function updateProject(id: string, updates: Partial<Project>): Promise<Project> {
  const { data, error } = await supabase
    .from('projects')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Delete project
export async function deleteProject(id: string): Promise<void> {
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// Profile Hours CRUD
export async function upsertProfileHours(projectId: string, profileHours: Partial<ProfileHours>[]): Promise<void> {
  for (const ph of profileHours) {
    if (ph.id) {
      await supabase.from('profile_hours').update(ph).eq('id', ph.id);
    } else {
      await supabase.from('profile_hours').insert([{ ...ph, project_id: projectId }]);
    }
  }
}

export async function deleteProfileHours(id: string): Promise<void> {
  await supabase.from('profile_hours').delete().eq('id', id);
}

// Scope Items CRUD
export async function createScopeItem(projectId: string, item: Partial<ScopeItem>): Promise<ScopeItem> {
  const { data, error } = await supabase
    .from('scope_items')
    .insert([{ ...item, project_id: projectId }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateScopeItem(id: string, updates: Partial<ScopeItem>): Promise<void> {
  await supabase.from('scope_items').update(updates).eq('id', id);
}

export async function deleteScopeItem(id: string): Promise<void> {
  await supabase.from('scope_items').delete().eq('id', id);
}

// External Costs CRUD
export async function createExternalCost(projectId: string, cost: Partial<ExternalCost>): Promise<ExternalCost> {
  const { data, error } = await supabase
    .from('external_costs')
    .insert([{ ...cost, project_id: projectId }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateExternalCost(id: string, updates: Partial<ExternalCost>): Promise<void> {
  await supabase.from('external_costs').update(updates).eq('id', id);
}

export async function deleteExternalCost(id: string): Promise<void> {
  await supabase.from('external_costs').delete().eq('id', id);
}

// Change Requests CRUD
export async function createChangeRequest(projectId: string, cr: Partial<ChangeRequest>): Promise<ChangeRequest> {
  const { data, error } = await supabase
    .from('change_requests')
    .insert([{ ...cr, project_id: projectId }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateChangeRequest(id: string, updates: Partial<ChangeRequest>): Promise<void> {
  await supabase.from('change_requests').update(updates).eq('id', id);
}

export async function deleteChangeRequest(id: string): Promise<void> {
  // Delete associated hours first
  await supabase.from('change_request_hours').delete().eq('change_request_id', id);
  await supabase.from('change_requests').delete().eq('id', id);
}

// Change Request Hours CRUD
export async function createChangeRequestHours(changeRequestId: string, hours: Partial<ChangeRequestHours>): Promise<ChangeRequestHours> {
  const { data, error } = await supabase
    .from('change_request_hours')
    .insert([{ ...hours, change_request_id: changeRequestId }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateChangeRequestHours(id: string, updates: Partial<ChangeRequestHours>): Promise<void> {
  await supabase.from('change_request_hours').update(updates).eq('id', id);
}

export async function deleteChangeRequestHours(id: string): Promise<void> {
  await supabase.from('change_request_hours').delete().eq('id', id);
}

// Fetch all projects with metrics for list view
export async function fetchProjectsWithMetrics(): Promise<(ProjectWithDetails & { metrics: ProjectMetrics })[]> {
  const projects = await fetchProjects();
  
  const projectsWithDetails = await Promise.all(
    projects.map(async (project) => {
      const details = await fetchProjectWithDetails(project.id);
      if (!details) return null;
      return {
        ...details,
        metrics: calculateMetrics(details),
      };
    })
  );

  return projectsWithDetails.filter(Boolean) as (ProjectWithDetails & { metrics: ProjectMetrics })[];
}

// Analytics helpers
export async function fetchAnalyticsData() {
  const projects = await fetchProjectsWithMetrics();
  
  const completedProjects = projects.filter(p => p.status === 'completed' || p.metrics.actualHours > 0);
  
  const totalProjects = projects.length;
  const activeProjects = projects.filter(p => p.status === 'active').length;
  
  const avgHoursVariance = completedProjects.length > 0
    ? completedProjects.reduce((sum, p) => sum + p.metrics.hoursVariancePercent, 0) / completedProjects.length
    : 0;
  
  const avgMarginDelta = completedProjects.length > 0
    ? completedProjects.reduce((sum, p) => sum + p.metrics.marginDelta, 0) / completedProjects.length
    : 0;
  
  const scopeCreepCount = projects.filter(p => p.scope_creep).length;
  const scopeCreepRate = totalProjects > 0 ? (scopeCreepCount / totalProjects) * 100 : 0;
  
  const totalRevenue = projects.reduce((sum, p) => sum + p.metrics.totalValue, 0);
  
  // Profile performance
  const profileStats: Record<string, { estimated: number; actual: number }> = {};
  for (const project of projects) {
    for (const ph of project.profile_hours) {
      if (!profileStats[ph.profile]) {
        profileStats[ph.profile] = { estimated: 0, actual: 0 };
      }
      profileStats[ph.profile].estimated += ph.estimated_hours;
      profileStats[ph.profile].actual += ph.actual_hours;
    }
  }

  return {
    totalProjects,
    activeProjects,
    avgHoursVariance,
    avgMarginDelta,
    scopeCreepRate,
    totalRevenue,
    profileStats,
    projects,
  };
}
