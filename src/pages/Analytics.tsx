import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileDown } from 'lucide-react';
import {
  Button, StatCard, Card, LoadingSpinner, Variance
} from '../components/ui';
import { fetchAnalyticsData, TARGET_MARGIN_MIN, TARGET_MARGIN_MAX } from '../lib/supabase';
import { exportAnalyticsExcel } from '../lib/export';
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
  const [activeTab, setActiveTab] = useState<'overall' | 'projects' | 'insights'>('overall');

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

  // Margin distribution based on target (50-55%)
  const projectsWithHours = data.projects.filter(p => p.metrics.actualHours > 0);
  const marginDistribution = [
    { range: '<45%', count: projectsWithHours.filter(p => p.metrics.actualMargin < 45).length, color: '#ef4444', label: 'Below Target' },
    { range: '45-50%', count: projectsWithHours.filter(p => p.metrics.actualMargin >= 45 && p.metrics.actualMargin < 50).length, color: '#f59e0b', label: 'Near Target' },
    { range: '50-55%', count: projectsWithHours.filter(p => p.metrics.actualMargin >= TARGET_MARGIN_MIN && p.metrics.actualMargin <= TARGET_MARGIN_MAX).length, color: '#10b981', label: 'On Target' },
    { range: '>55%', count: projectsWithHours.filter(p => p.metrics.actualMargin > TARGET_MARGIN_MAX).length, color: '#3b82f6', label: 'Above Target' },
  ];

  const onTargetProjects = projectsWithHours.filter(p => p.metrics.actualMargin >= TARGET_MARGIN_MIN && p.metrics.actualMargin <= TARGET_MARGIN_MAX).length;
  const aboveTargetProjects = projectsWithHours.filter(p => p.metrics.actualMargin > TARGET_MARGIN_MAX).length;
  const successRate = projectsWithHours.length > 0 ? ((onTargetProjects + aboveTargetProjects) / projectsWithHours.length) * 100 : 0;
  const avgActualMargin = projectsWithHours.length > 0 ? projectsWithHours.reduce((sum, p) => sum + p.metrics.actualMargin, 0) / projectsWithHours.length : 0;

  // Scope creep projects
  const scopeCreepProjects = data.projects.filter(p => p.scope_creep && p.scope_creep_notes);

  // Best went_well and went_wrong insights
  const projectsWithWentWell = data.projects.filter(p => p.went_well);
  const projectsWithWentWrong = data.projects.filter(p => p.went_wrong);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
          <p className="text-sm text-slate-500 mt-1">Insights across all projects</p>
        </div>
        <Button variant="secondary" onClick={() => exportAnalyticsExcel(data.projects, data.profileStats)}>
          <FileDown className="w-4 h-4" />
          Export Excel
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-200 p-1 rounded-lg w-fit">
        {[
          { id: 'overall', label: 'Overall' },
          { id: 'projects', label: 'By Project' },
          { id: 'insights', label: 'Insights' },
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
              label="Success Rate"
              value={`${successRate.toFixed(0)}%`}
              subtext={`${onTargetProjects + aboveTargetProjects} of ${projectsWithHours.length} projects ≥50%`}
            />
            <StatCard
              label="Avg Actual Margin"
              value={`${avgActualMargin.toFixed(0)}%`}
              subtext={`Target: ${TARGET_MARGIN_MIN}-${TARGET_MARGIN_MAX}%`}
            />
            <StatCard
              label="Scope Creep Rate"
              value={`${data.scopeCreepRate.toFixed(0)}%`}
              subtext={`${data.projects.filter(p => p.scope_creep).length} of ${data.totalProjects} projects`}
            />
          </div>

          <div className="grid grid-cols-2 gap-6 mb-6">
            {/* Margin Distribution */}
            <Card>
              <h3 className="text-sm font-semibold text-slate-900 mb-5">Actual Margin Distribution (Target: 50-55%)</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={marginDistribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="range" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="count" name="Projects">
                    {marginDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="flex gap-4 mt-3 text-xs">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500"></span> Below 45%</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-500"></span> 45-50%</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500"></span> 50-55% (Target)</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-500"></span> Above 55%</span>
              </div>
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

          {/* Hours Variance Distribution */}
          <Card>
            <h3 className="text-sm font-semibold text-slate-900 mb-5">Hours Variance Distribution</h3>
            <ResponsiveContainer width="100%" height={180}>
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
        </>
      )}

      {/* Insights Tab */}
      {activeTab === 'insights' && (
        <div className="space-y-6">
          {/* Scope Creep Summary */}
          <Card>
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Scope Creep Issues</h3>
            {scopeCreepProjects.length === 0 ? (
              <p className="text-sm text-slate-400">No scope creep recorded</p>
            ) : (
              <div className="space-y-3">
                {scopeCreepProjects.map((project) => (
                  <div
                    key={project.id}
                    className="p-3 bg-red-50 border border-red-100 rounded-lg cursor-pointer hover:bg-red-100"
                    onClick={() => navigate(`/projects/${project.id}`)}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-medium text-sm text-slate-900">{project.name}</span>
                      <span className="text-xs text-slate-400">{project.client}</span>
                    </div>
                    <p className="text-sm text-red-700">{project.scope_creep_notes}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <div className="grid grid-cols-2 gap-6">
            {/* What Went Well */}
            <Card>
              <h3 className="text-sm font-semibold text-slate-900 mb-4">What Went Well</h3>
              {projectsWithWentWell.length === 0 ? (
                <p className="text-sm text-slate-400">No feedback recorded</p>
              ) : (
                <div className="space-y-3">
                  {projectsWithWentWell.slice(0, 5).map((project) => (
                    <div
                      key={project.id}
                      className="p-3 bg-emerald-50 border border-emerald-100 rounded-lg cursor-pointer hover:bg-emerald-100"
                      onClick={() => navigate(`/projects/${project.id}`)}
                    >
                      <div className="font-medium text-sm text-slate-900 mb-1">{project.name}</div>
                      <p className="text-sm text-emerald-700">{project.went_well}</p>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* What Went Wrong */}
            <Card>
              <h3 className="text-sm font-semibold text-slate-900 mb-4">What Went Wrong</h3>
              {projectsWithWentWrong.length === 0 ? (
                <p className="text-sm text-slate-400">No feedback recorded</p>
              ) : (
                <div className="space-y-3">
                  {projectsWithWentWrong.slice(0, 5).map((project) => (
                    <div
                      key={project.id}
                      className="p-3 bg-amber-50 border border-amber-100 rounded-lg cursor-pointer hover:bg-amber-100"
                      onClick={() => navigate(`/projects/${project.id}`)}
                    >
                      <div className="font-medium text-sm text-slate-900 mb-1">{project.name}</div>
                      <p className="text-sm text-amber-700">{project.went_wrong}</p>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
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
                        project.metrics.actualMargin >= TARGET_MARGIN_MIN
                          ? 'text-emerald-500'
                          : project.metrics.actualMargin >= 45
                            ? 'text-amber-500'
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

// Team Performance page - detailed role analysis
export function TeamPerformance() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

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
        Error loading team data
      </div>
    );
  }

  // Calculate detailed profile stats
  const profileDetails = Object.entries(data.profileStats).map(([profile, stats]) => {
    const variance = stats.estimated > 0 ? ((stats.actual - stats.estimated) / stats.estimated) * 100 : 0;
    const avgMistake = stats.estimated > 0 ? Math.abs(stats.actual - stats.estimated) / data.projects.length : 0;

    // Count how many projects this profile was accurate (within 10%)
    let accurateProjects = 0;
    let totalProjectsWithProfile = 0;
    let marginImpact = 0;

    for (const project of data.projects) {
      const profileHour = project.profile_hours.find(ph => ph.profile === profile);
      if (profileHour && (profileHour.estimated_hours > 0 || profileHour.actual_hours > 0)) {
        totalProjectsWithProfile++;
        const projectVariance = profileHour.estimated_hours > 0
          ? Math.abs((profileHour.actual_hours - profileHour.estimated_hours) / profileHour.estimated_hours) * 100
          : 0;
        if (projectVariance <= 10) {
          accurateProjects++;
        }
        // Calculate margin impact (hours over * hourly rate approximation)
        const hoursOver = profileHour.actual_hours - profileHour.estimated_hours;
        marginImpact += hoursOver * 75; // Approximate hourly rate
      }
    }

    const accuracyRate = totalProjectsWithProfile > 0 ? (accurateProjects / totalProjectsWithProfile) * 100 : 0;

    return {
      profile,
      estimated: stats.estimated,
      actual: stats.actual,
      variance,
      avgMistake,
      accurateProjects,
      totalProjectsWithProfile,
      accuracyRate,
      marginImpact,
    };
  });

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Team Performance</h1>
        <p className="text-sm text-slate-500 mt-1">Estimation accuracy and impact by role</p>
      </div>

      {/* Profile Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {profileDetails.map((item) => {
          const isGood = item.accuracyRate >= 70;
          const isWarning = item.accuracyRate >= 50 && item.accuracyRate < 70;

          let borderColor = 'border-l-red-500';
          let badgeColor = 'bg-red-100 text-red-600';

          if (isGood) {
            borderColor = 'border-l-emerald-500';
            badgeColor = 'bg-emerald-100 text-emerald-600';
          } else if (isWarning) {
            borderColor = 'border-l-amber-500';
            badgeColor = 'bg-amber-100 text-amber-600';
          }

          return (
            <Card key={item.profile} className={`border-l-4 ${borderColor}`}>
              <div className="flex justify-between items-start mb-4">
                <span className="text-lg font-bold text-slate-900">{item.profile}</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded ${badgeColor}`}>
                  {item.accuracyRate.toFixed(0)}% accurate
                </span>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="text-xs text-slate-500 uppercase mb-1">Projects Within 10%</div>
                  <div className="text-lg font-semibold">
                    {item.accurateProjects} / {item.totalProjectsWithProfile}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-slate-500 uppercase mb-1">Avg Planning Error</div>
                  <div className="text-lg font-semibold">
                    {item.avgMistake.toFixed(1)}h per project
                  </div>
                </div>

                <div>
                  <div className="text-xs text-slate-500 uppercase mb-1">Margin Impact</div>
                  <div className={`text-lg font-semibold ${item.marginImpact > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                    {item.marginImpact > 0 ? '-' : '+'}€{Math.abs(item.marginImpact).toLocaleString()}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Estimated</span>
                    <span className="font-medium">{item.estimated}h</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Actual</span>
                    <span className="font-medium">{item.actual}h</span>
                  </div>
                  <div className="flex justify-between text-sm mt-2">
                    <span className="text-slate-500">Variance</span>
                    <Variance value={item.variance} />
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
