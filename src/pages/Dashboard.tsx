import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { StatCard, StatusBadge, LoadingSpinner, Card, MarginDisplay, Variance } from '../components/ui';
import { fetchProjectsWithMetrics } from '../lib/supabase';
import type { ProjectWithDetails, ProjectMetrics } from '../types';

type ProjectWithMetrics = ProjectWithDetails & { metrics: ProjectMetrics };

export function Dashboard() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectWithMetrics[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const data = await fetchProjectsWithMetrics();
      setProjects(data);
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <LoadingSpinner />
      </div>
    );
  }

  const completedProjects = projects.filter(p => p.status === 'completed');
  const activeProjects = projects.filter(p => p.status === 'active');
  const totalValue = projects.reduce((sum, p) => sum + p.metrics.totalValue, 0);
  const totalEstHours = projects.reduce((sum, p) => sum + p.metrics.estimatedHours, 0);
  const totalActualHours = projects.reduce((sum, p) => sum + p.metrics.actualHours, 0);
  const hoursPercent = totalEstHours > 0 ? Math.round((totalActualHours / totalEstHours) * 100) : 0;

  const avgMarginDelta = projects.length > 0
    ? projects.reduce((sum, p) => sum + p.metrics.marginDelta, 0) / projects.length
    : 0;

  // Profile estimation accuracy - all profiles
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

  const profileAccuracy = Object.entries(profileStats)
    .map(([profile, stats]) => ({
      profile,
      variance: stats.estimated > 0 ? ((stats.actual - stats.estimated) / stats.estimated) * 100 : 0,
    }))
    .sort((a, b) => b.variance - a.variance);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">Overview of your projects and performance</p>
      </div>

      {/* Stats */}
      <div className="flex gap-4 mb-8">
        <StatCard
          label="Total Projects"
          value={projects.length}
          subtext={`${completedProjects.length} completed, ${activeProjects.length} active`}
        />
        <StatCard
          label="Total Value"
          value={`€${(totalValue / 1000).toFixed(0)}k`}
          subtext="All projects"
        />
        <StatCard
          label="Hours Budget"
          value={`${hoursPercent}%`}
          subtext={`${totalActualHours}h / ${totalEstHours}h`}
        />
        <StatCard
          label="Avg Margin Delta"
          value={`${avgMarginDelta >= 0 ? '+' : ''}${avgMarginDelta.toFixed(1)}%`}
          trend={avgMarginDelta < 0 ? `${avgMarginDelta.toFixed(1)}% from target` : undefined}
        />
      </div>

      {/* All Projects Table */}
      <Card padding={false} className="mb-6">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <h2 className="text-base font-semibold text-slate-900">All Projects</h2>
          <button
            onClick={() => navigate('/projects')}
            className="text-sm text-blue-600 font-medium hover:text-blue-700"
          >
            View all →
          </button>
        </div>

        {projects.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            No projects yet. Create your first project to get started.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Project</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Hours</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Margin</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((project) => (
                  <tr
                    key={project.id}
                    className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                    onClick={() => navigate(`/projects/${project.id}`)}
                  >
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900 text-sm">{project.name}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{project.client}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{project.project_type}</td>
                    <td className="px-6 py-4">
                      <StatusBadge status={project.status} />
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700">
                      {project.metrics.actualHours}h / {project.metrics.estimatedHours}h
                      <span className="ml-2">
                        <Variance value={project.metrics.hoursVariancePercent} />
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <MarginDisplay
                        estimated={project.metrics.estimatedMargin}
                        actual={project.metrics.actualMargin}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Bottom Row */}
      <div className="flex gap-4">
        <Card className="flex-1">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Estimation Accuracy by Role</h3>
          {profileAccuracy.length === 0 ? (
            <p className="text-sm text-slate-400">No data yet</p>
          ) : (
            profileAccuracy.map((item, i) => (
              <div 
                key={item.profile} 
                className={`flex justify-between items-center py-2 ${i < profileAccuracy.length - 1 ? 'border-b border-slate-100' : ''}`}
              >
                <span className="text-sm font-medium text-slate-700">{item.profile}</span>
                <Variance value={item.variance} />
              </div>
            ))
          )}
        </Card>
        
        <Card className="flex-1">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Recent Activity</h3>
          <p className="text-sm text-slate-400">No recent activity</p>
        </Card>
      </div>
    </div>
  );
}
