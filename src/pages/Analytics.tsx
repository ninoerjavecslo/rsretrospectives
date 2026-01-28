import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileDown } from 'lucide-react';
import { 
  Button, StatCard, Card, LoadingSpinner, Variance
} from '../components/ui';
import { fetchAnalyticsData } from '../lib/supabase';
import type { ProjectWithDetails, ProjectMetrics } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Cell, Legend 
} from 'recharts';

type AnalyticsData = {
  totalProjects: number;
  activeProjects: number;
  avgHoursVariance: number;
  avgMarginDelta: number;
  scopeCreepRate: number;
  totalRevenue: number;
  profileStats: Record<string, { estimated: number; actual: number }>;
  projects: (ProjectWithDetails & { metrics: ProjectMetrics })[];
};

export function Analytics() {
  const navigate = useNavigate();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overall' | 'projects' | 'team'>('overall');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const analytics = await fetchAnalyticsData();
      setData(analytics);
    } catch (error) {
      console.error('Error loading analytics:', error);
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

  if (!data) {
    return (
      <div className="p-8 text-center text-slate-400">
        Error loading analytics data
      </div>
    );
  }

  // Prepare chart data
  const profileChartData = Object.entries(data.profileStats).map(([profile, stats]) => ({
    profile,
    estimated: stats.estimated,
    actual: stats.actual,
    variance: stats.estimated > 0 ? ((stats.actual - stats.estimated) / stats.estimated) * 100 : 0,
  }));

  const varianceDistribution = [
    { range: '<-10%', count: data.projects.filter(p => p.metrics.hoursVariancePercent < -10).length, color: '#10b981' },
    { range: '-10-0%', count: data.projects.filter(p => p.metrics.hoursVariancePercent >= -10 && p.metrics.hoursVariancePercent < 0).length, color: '#34d399' },
    { range: '0-10%', count: data.projects.filter(p => p.metrics.hoursVariancePercent >= 0 && p.metrics.hoursVariancePercent < 10).length, color: '#fbbf24' },
    { range: '10-20%', count: data.projects.filter(p => p.metrics.hoursVariancePercent >= 10 && p.metrics.hoursVariancePercent < 20).length, color: '#f59e0b' },
    { range: '>20%', count: data.projects.filter(p => p.metrics.hoursVariancePercent >= 20).length, color: '#ef4444' },
  ];

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
          <p className="text-sm text-slate-500 mt-1">Insights across all projects</p>
        </div>
        <Button variant="secondary">
          <FileDown className="w-4 h-4" />
          Export Report
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-200 p-1 rounded-lg w-fit">
        {[
          { id: 'overall', label: 'Overall' },
          { id: 'projects', label: 'By Project' },
          { id: 'team', label: 'By Team' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`px-5 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overall Tab */}
      {activeTab === 'overall' && (
        <>
          <div className="flex gap-4 mb-6">
            <StatCard label="Total Projects" value={data.totalProjects} subtext={`${data.activeProjects} active`} />
            <StatCard label="Total Revenue" value={`€${(data.totalRevenue / 1000).toFixed(0)}k`} subtext="All projects" />
            <StatCard 
              label="Avg Hours Variance" 
              value={`${data.avgHoursVariance >= 0 ? '+' : ''}${data.avgHoursVariance.toFixed(0)}%`}
            />
            <StatCard 
              label="Avg Margin Delta" 
              value={`${data.avgMarginDelta >= 0 ? '+' : ''}${data.avgMarginDelta.toFixed(1)}%`}
            />
            <StatCard 
              label="Scope Creep Rate" 
              value={`${data.scopeCreepRate.toFixed(0)}%`}
              subtext={`${data.projects.filter(p => p.scope_creep).length} of ${data.totalProjects} projects`}
            />
          </div>

          <div className="grid grid-cols-2 gap-6">
            {/* Hours Variance Distribution */}
            <Card>
              <h3 className="text-sm font-semibold text-slate-900 mb-5">Hours Variance Distribution</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={varianceDistribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="range" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="count" name="Projects">
                    {varianceDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>

            {/* Profile Comparison */}
            <Card>
              <h3 className="text-sm font-semibold text-slate-900 mb-5">Hours by Profile</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={profileChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="profile" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="estimated" name="Estimated" fill="#94a3b8" />
                  <Bar dataKey="actual" name="Actual" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>
        </>
      )}

      {/* By Team Tab */}
      {activeTab === 'team' && (
        <div className="grid grid-cols-3 gap-4">
          {profileChartData.map((item) => {
            const isWarning = item.variance > 10 && item.variance <= 20;
            const isBad = item.variance > 20;
            
            let status = 'Good';
            let borderColor = 'border-l-emerald-500';
            let badgeColor = 'bg-emerald-100 text-emerald-600';
            let valueColor = 'text-emerald-500';
            
            if (item.variance < -5) {
              status = 'Excellent';
            } else if (isWarning) {
              status = 'Needs Improvement';
              borderColor = 'border-l-amber-500';
              badgeColor = 'bg-amber-100 text-amber-600';
              valueColor = 'text-amber-500';
            } else if (isBad) {
              status = 'Poor';
              borderColor = 'border-l-red-500';
              badgeColor = 'bg-red-100 text-red-600';
              valueColor = 'text-red-500';
            }

            return (
              <Card key={item.profile} className={`border-l-4 ${borderColor}`}>
                <div className="flex justify-between items-start mb-3">
                  <span className="text-lg font-bold text-slate-900">{item.profile}</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded ${badgeColor}`}>
                    {status}
                  </span>
                </div>
                <div className="space-y-1 mb-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Estimated</span>
                    <span className="font-medium">{item.estimated}h</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Actual</span>
                    <span className="font-medium">{item.actual}h</span>
                  </div>
                </div>
                <div className={`text-2xl font-bold ${valueColor}`}>
                  {item.variance >= 0 ? '+' : ''}{item.variance.toFixed(0)}%
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* By Project Tab */}
      {activeTab === 'projects' && (
        <Card padding={false}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase">Project</th>
                  <th className="px-4 py-3.5 text-right text-xs font-semibold text-slate-500 uppercase">Value</th>
                  <th className="px-4 py-3.5 text-right text-xs font-semibold text-slate-500 uppercase">Hours Var</th>
                  <th className="px-4 py-3.5 text-right text-xs font-semibold text-slate-500 uppercase">Est Margin</th>
                  <th className="px-4 py-3.5 text-right text-xs font-semibold text-slate-500 uppercase">Act Margin</th>
                  <th className="px-4 py-3.5 text-center text-xs font-semibold text-slate-500 uppercase">Scope Creep</th>
                </tr>
              </thead>
              <tbody>
                {data.projects.map((project) => (
                  <tr 
                    key={project.id} 
                    className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                    onClick={() => navigate(`/projects/${project.id}`)}
                  >
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900 text-sm">{project.name}</div>
                      <div className="text-xs text-slate-400">{project.client}</div>
                    </td>
                    <td className="px-4 py-4 text-right font-semibold text-sm">
                      €{project.metrics.totalValue.toLocaleString()}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <Variance value={project.metrics.hoursVariancePercent} />
                    </td>
                    <td className="px-4 py-4 text-right text-sm text-slate-500">
                      {project.metrics.estimatedMargin.toFixed(0)}%
                    </td>
                    <td className="px-4 py-4 text-right">
                      <span className={`font-semibold text-sm ${
                        project.metrics.actualMargin >= project.metrics.estimatedMargin 
                          ? 'text-emerald-500' 
                          : 'text-red-500'
                      }`}>
                        {project.metrics.actualMargin.toFixed(0)}%
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      {project.scope_creep ? (
                        <span className="text-red-500">🚩</span>
                      ) : (
                        <span className="text-emerald-500">✓</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

// Team Performance page - just redirects to Analytics with team tab
export function TeamPerformance() {
  const navigate = useNavigate();
  
  useEffect(() => {
    navigate('/analytics', { replace: true });
  }, [navigate]);

  return null;
}
