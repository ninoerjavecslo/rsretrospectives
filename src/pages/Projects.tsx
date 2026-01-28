import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Button, HealthBadge, StatusBadge, LoadingSpinner, Card, MarginDisplay, Variance } from '../components/ui';
import { fetchProjectsWithMetrics, createProject } from '../lib/supabase';
import type { ProjectWithDetails, ProjectMetrics } from '../types';

type ProjectWithMetrics = ProjectWithDetails & { metrics: ProjectMetrics };

export function Projects() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectWithMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed' | 'draft'>('all');

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

  async function handleCreateProject() {
    try {
      const newProject = await createProject({ name: 'New Project' });
      navigate(`/projects/${newProject.id}`);
    } catch (error) {
      console.error('Error creating project:', error);
    }
  }

  const filteredProjects = projects.filter(p => {
    if (filter === 'all') return true;
    return p.status === filter;
  });

  if (loading) {
    return (
      <div className="p-8">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Projects</h1>
          <p className="text-sm text-slate-500 mt-1">Manage and track all your projects</p>
        </div>
        <Button onClick={handleCreateProject}>
          <Plus className="w-4 h-4" />
          Add Project
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6">
        {(['all', 'active', 'completed', 'draft'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-md text-sm font-medium capitalize ${
              filter === f 
                ? 'bg-slate-900 text-white' 
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Projects Table */}
      <Card padding={false}>
        {filteredProjects.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            {filter === 'all' 
              ? 'No projects yet. Create your first project to get started.'
              : `No ${filter} projects.`
            }
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Project</th>
                  <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Type</th>
                  <th className="px-4 py-3.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Value</th>
                  <th className="px-4 py-3.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Hours</th>
                  <th className="px-4 py-3.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Variance</th>
                  <th className="px-4 py-3.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Margin</th>
                  <th className="px-4 py-3.5 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">Health</th>
                  <th className="px-4 py-3.5 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredProjects.map((project) => {
                  const crTotal = project.change_requests?.reduce((sum, cr) => sum + cr.amount, 0) || 0;
                  
                  return (
                    <tr 
                      key={project.id} 
                      className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                      onClick={() => navigate(`/projects/${project.id}`)}
                    >
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900 text-sm">{project.name}</div>
                        <div className="text-xs text-slate-400 mt-0.5">{project.client || 'No client'}</div>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-600">{project.project_type || '-'}</td>
                      <td className="px-4 py-4 text-right">
                        <div className="font-semibold text-slate-900 text-sm">
                          €{project.metrics.totalValue.toLocaleString()}
                        </div>
                        {crTotal > 0 && (
                          <div className="text-xs text-emerald-500 mt-0.5">
                            +€{crTotal.toLocaleString()} CR
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4 text-right text-sm text-slate-700">
                        {project.metrics.actualHours}h / {project.metrics.estimatedHours}h
                      </td>
                      <td className="px-4 py-4 text-right">
                        <Variance value={project.metrics.hoursVariancePercent} />
                      </td>
                      <td className="px-4 py-4 text-right">
                        <MarginDisplay 
                          estimated={project.metrics.estimatedMargin} 
                          actual={project.metrics.actualMargin} 
                        />
                      </td>
                      <td className="px-4 py-4 text-center">
                        <HealthBadge status={project.metrics.health} />
                      </td>
                      <td className="px-4 py-4 text-center">
                        <StatusBadge status={project.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
