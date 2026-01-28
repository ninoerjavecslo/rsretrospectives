import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, X, Plus, Trash2, FileDown } from 'lucide-react';
import { 
  Button, Input, Textarea, Select, Checkbox, Card, CardHeader,
  StatusBadge, HealthBadge, LoadingSpinner, Variance, StatCard
} from '../components/ui';
import { 
  fetchProjectWithDetails, updateProject, deleteProject,
  createScopeItem, updateScopeItem, deleteScopeItem,
  createExternalCost, updateExternalCost, deleteExternalCost,
  createChangeRequest, deleteChangeRequest,
  calculateMetrics, supabase
} from '../lib/supabase';
import type { 
  ProjectWithDetails, ProfileHours, ScopeItem, ExternalCost, ChangeRequest,
  Profile, ScopeItemType
} from '../types';

const PROFILE_LIST: Profile[] = ['UX', 'UI', 'DEV', 'PM', 'CONTENT', 'ANALYTICS'];
const SCOPE_TYPE_LIST: ScopeItemType[] = ['Wireframe', 'Component', 'Page', 'Template', 'Integration', 'Custom'];
const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
];

export function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [project, setProject] = useState<ProjectWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  
  const [formData, setFormData] = useState<Partial<ProjectWithDetails>>({});
  const [profileHours, setProfileHours] = useState<ProfileHours[]>([]);
  const [scopeItems, setScopeItems] = useState<ScopeItem[]>([]);
  const [externalCosts, setExternalCosts] = useState<ExternalCost[]>([]);
  const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>([]);

  useEffect(() => {
    if (id) loadProject();
  }, [id]);

  async function loadProject() {
    try {
      const data = await fetchProjectWithDetails(id!);
      if (data) {
        setProject(data);
        resetForm(data);
      }
    } catch (error) {
      console.error('Error loading project:', error);
    } finally {
      setLoading(false);
    }
  }

  function resetForm(data: ProjectWithDetails) {
    setFormData({
      name: data.name,
      client: data.client,
      project_type: data.project_type,
      cms: data.cms,
      integrations: data.integrations,
      offer_value: data.offer_value,
      estimated_profit_margin: data.estimated_profit_margin,
      went_well: data.went_well,
      went_wrong: data.went_wrong,
      scope_creep: data.scope_creep,
      scope_creep_notes: data.scope_creep_notes,
      status: data.status,
    });
    
    const existingProfiles = new Set(data.profile_hours.map(ph => ph.profile));
    const allProfileHours = [...data.profile_hours];
    for (const profile of PROFILE_LIST) {
      if (!existingProfiles.has(profile)) {
        allProfileHours.push({
          id: `new-${profile}`,
          project_id: data.id,
          profile,
          estimated_hours: 0,
          actual_hours: 0,
        });
      }
    }
    setProfileHours(allProfileHours);
    setScopeItems(data.scope_items);
    setExternalCosts(data.external_costs);
    setChangeRequests(data.change_requests);
  }

  async function handleSave() {
    if (!project) return;
    setSaving(true);

    try {
      await updateProject(project.id, formData);

      for (const ph of profileHours) {
        if (ph.id.startsWith('new-')) {
          if (ph.estimated_hours > 0 || ph.actual_hours > 0) {
            await supabase.from('profile_hours').insert([{
              project_id: project.id,
              profile: ph.profile,
              estimated_hours: ph.estimated_hours,
              actual_hours: ph.actual_hours,
            }]);
          }
        } else {
          await supabase.from('profile_hours').update({
            estimated_hours: ph.estimated_hours,
            actual_hours: ph.actual_hours,
          }).eq('id', ph.id);
        }
      }

      for (const item of scopeItems) {
        if (item.id.startsWith('new-')) {
          await createScopeItem(project.id, {
            name: item.name,
            type: item.type,
            planned_count: item.planned_count,
            actual_count: item.actual_count,
            notes: item.notes,
          });
        } else {
          await updateScopeItem(item.id, {
            name: item.name,
            type: item.type,
            planned_count: item.planned_count,
            actual_count: item.actual_count,
            notes: item.notes,
          });
        }
      }

      for (const cost of externalCosts) {
        if (cost.id.startsWith('new-')) {
          await createExternalCost(project.id, {
            description: cost.description,
            estimated_cost: cost.estimated_cost,
            actual_cost: cost.actual_cost,
            notes: cost.notes,
          });
        } else {
          await updateExternalCost(cost.id, {
            description: cost.description,
            estimated_cost: cost.estimated_cost,
            actual_cost: cost.actual_cost,
            notes: cost.notes,
          });
        }
      }

      await loadProject();
      setEditMode(false);
    } catch (error) {
      console.error('Error saving project:', error);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!project || !confirm('Are you sure you want to delete this project?')) return;
    
    try {
      await deleteProject(project.id);
      navigate('/projects');
    } catch (error) {
      console.error('Error deleting project:', error);
    }
  }

  function handleCancel() {
    if (project) resetForm(project);
    setEditMode(false);
  }

  function addScopeItem() {
    setScopeItems([...scopeItems, {
      id: `new-${Date.now()}`,
      project_id: project!.id,
      name: '',
      type: 'Component',
      planned_count: 0,
      actual_count: 0,
      notes: '',
    }]);
  }

  function addExternalCost() {
    setExternalCosts([...externalCosts, {
      id: `new-${Date.now()}`,
      project_id: project!.id,
      description: '',
      estimated_cost: 0,
      actual_cost: 0,
      notes: '',
    }]);
  }

  async function addChangeRequest() {
    if (!project) return;
    const cr = await createChangeRequest(project.id, {
      description: 'New change request',
      amount: 0,
    });
    setChangeRequests([...changeRequests, cr]);
  }

  async function removeChangeRequest(crId: string) {
    await deleteChangeRequest(crId);
    setChangeRequests(changeRequests.filter(cr => cr.id !== crId));
  }

  function removeScopeItem(itemId: string) {
    if (!itemId.startsWith('new-')) {
      deleteScopeItem(itemId);
    }
    setScopeItems(scopeItems.filter(i => i.id !== itemId));
  }

  function removeExternalCost(costId: string) {
    if (!costId.startsWith('new-')) {
      deleteExternalCost(costId);
    }
    setExternalCosts(externalCosts.filter(c => c.id !== costId));
  }

  if (loading) {
    return <div className="p-8"><LoadingSpinner /></div>;
  }

  if (!project) {
    return (
      <div className="p-8 text-center">
        <p className="text-slate-500">Project not found</p>
        <Button variant="secondary" onClick={() => navigate('/projects')} className="mt-4">
          Back to Projects
        </Button>
      </div>
    );
  }

  const displayProject: ProjectWithDetails = {
    ...project,
    ...formData,
    profile_hours: profileHours.filter(ph => !ph.id.startsWith('new-') || ph.estimated_hours > 0 || ph.actual_hours > 0),
    scope_items: scopeItems,
    external_costs: externalCosts,
    change_requests: changeRequests,
  } as ProjectWithDetails;
  
  const metrics = calculateMetrics(displayProject);
  const crTotal = changeRequests.reduce((sum, cr) => sum + cr.amount, 0);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <button 
            onClick={() => navigate('/projects')} 
            className="flex items-center gap-1 text-slate-500 text-sm mb-3 hover:text-slate-700"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Projects
          </button>
          <div className="flex items-center gap-3 flex-wrap">
            {editMode ? (
              <input
                type="text"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="text-2xl font-bold text-slate-900 border-b-2 border-blue-500 bg-transparent outline-none"
              />
            ) : (
              <h1 className="text-2xl font-bold text-slate-900">{project.name}</h1>
            )}
            <StatusBadge status={formData.status || project.status} />
            <HealthBadge status={metrics.health} />
          </div>
          <p className="text-sm text-slate-500 mt-1">
            {project.client || 'No client'} • {project.project_type || 'No type'} • {project.cms || 'No CMS'}
          </p>
        </div>
        
        <div className="flex gap-3">
          {!editMode ? (
            <>
              <Button variant="secondary"><FileDown className="w-4 h-4" /> Export</Button>
              <Button onClick={() => setEditMode(true)}>Edit Project</Button>
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={handleCancel}><X className="w-4 h-4" /> Cancel</Button>
              <Button variant="success" onClick={handleSave} disabled={saving}>
                <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save'}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Financial Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard 
          label="Total Value" 
          value={`€${metrics.totalValue.toLocaleString()}`}
          subtext={crTotal > 0 ? `€${(formData.offer_value || project.offer_value).toLocaleString()} + €${crTotal.toLocaleString()} CRs` : undefined}
        />
        <StatCard 
          label="Hours" 
          value={`${metrics.actualHours}h`}
          subtext={`/ ${metrics.estimatedHours}h estimated`}
          trend={metrics.hoursVariance !== 0 ? `${metrics.hoursVariance > 0 ? '+' : ''}${metrics.hoursVariance}h (${metrics.hoursVariancePercent.toFixed(0)}%)` : undefined}
        />
        <StatCard 
          label="Est. Margin" 
          value={`${metrics.estimatedMargin.toFixed(0)}%`}
          subtext={`€${metrics.estimatedProfit.toLocaleString()} target`}
        />
        <div className={`rounded-xl p-5 border ${metrics.actualMargin >= metrics.estimatedMargin ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
          <div className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wide">Actual Margin</div>
          <div className={`text-2xl font-bold ${metrics.actualMargin >= metrics.estimatedMargin ? 'text-emerald-600' : 'text-red-600'}`}>
            {metrics.actualMargin.toFixed(0)}%
          </div>
          <div className={`text-xs mt-1 ${metrics.marginDelta >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {metrics.marginDelta >= 0 ? '+' : ''}{metrics.marginDelta.toFixed(1)}% vs target
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="col-span-2 space-y-6">
          {/* Profile Hours */}
          <Card padding={false}>
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-base font-semibold text-slate-900">Hours by Profile</h2>
            </div>
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Profile</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Estimated</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Actual</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Variance</th>
                </tr>
              </thead>
              <tbody>
                {profileHours.map((ph) => {
                  const variance = ph.actual_hours - ph.estimated_hours;
                  const variancePercent = ph.estimated_hours > 0 ? (variance / ph.estimated_hours) * 100 : 0;
                  
                  return (
                    <tr key={ph.id} className="border-b border-slate-100">
                      <td className="px-6 py-3 font-medium text-slate-700">{ph.profile}</td>
                      <td className="px-4 py-3 text-center">
                        {editMode ? (
                          <input
                            type="number"
                            value={ph.estimated_hours}
                            onChange={(e) => setProfileHours(profileHours.map(p => 
                              p.id === ph.id ? { ...p, estimated_hours: Number(e.target.value) } : p
                            ))}
                            className="w-20 px-2 py-1 border border-slate-200 rounded text-center text-sm"
                          />
                        ) : (
                          <span className="text-sm text-slate-600">{ph.estimated_hours}h</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {editMode ? (
                          <input
                            type="number"
                            value={ph.actual_hours}
                            onChange={(e) => setProfileHours(profileHours.map(p => 
                              p.id === ph.id ? { ...p, actual_hours: Number(e.target.value) } : p
                            ))}
                            className="w-20 px-2 py-1 border border-slate-200 rounded text-center text-sm"
                          />
                        ) : (
                          <span className="text-sm font-medium text-slate-900">{ph.actual_hours}h</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {(ph.estimated_hours > 0 || ph.actual_hours > 0) && <Variance value={variancePercent} />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 border-t-2 border-slate-200">
                  <td className="px-6 py-3 font-bold text-slate-900">Total</td>
                  <td className="px-4 py-3 text-center font-bold">{metrics.estimatedHours}h</td>
                  <td className="px-4 py-3 text-center font-bold">{metrics.actualHours}h</td>
                  <td className="px-4 py-3 text-center"><Variance value={metrics.hoursVariancePercent} /></td>
                </tr>
              </tfoot>
            </table>
          </Card>

          {/* Scope Items */}
          <Card padding={false}>
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-base font-semibold text-slate-900">Scope Items (Deliverables)</h2>
              {editMode && (
                <Button variant="ghost" size="sm" onClick={addScopeItem}>
                  <Plus className="w-4 h-4" /> Add
                </Button>
              )}
            </div>
            
            {scopeItems.length === 0 ? (
              <div className="p-6 text-center text-slate-400">
                No scope items yet.
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Item</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Type</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Planned</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Actual</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Notes</th>
                    {editMode && <th className="px-4 py-3 w-10"></th>}
                  </tr>
                </thead>
                <tbody>
                  {scopeItems.map((item) => (
                    <tr key={item.id} className="border-b border-slate-100">
                      <td className="px-6 py-3">
                        {editMode ? (
                          <input type="text" value={item.name} placeholder="Name..."
                            onChange={(e) => setScopeItems(scopeItems.map(i => i.id === item.id ? { ...i, name: e.target.value } : i))}
                            className="w-full px-2 py-1 border border-slate-200 rounded text-sm"
                          />
                        ) : (
                          <span className="font-medium text-slate-900 text-sm">{item.name}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editMode ? (
                          <select value={item.type}
                            onChange={(e) => setScopeItems(scopeItems.map(i => i.id === item.id ? { ...i, type: e.target.value as ScopeItemType } : i))}
                            className="px-2 py-1 border border-slate-200 rounded text-sm"
                          >
                            {SCOPE_TYPE_LIST.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        ) : (
                          <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{item.type}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {editMode ? (
                          <input type="number" value={item.planned_count}
                            onChange={(e) => setScopeItems(scopeItems.map(i => i.id === item.id ? { ...i, planned_count: Number(e.target.value) } : i))}
                            className="w-16 px-2 py-1 border border-slate-200 rounded text-center text-sm"
                          />
                        ) : (
                          <span className="text-sm text-slate-600">{item.planned_count}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {editMode ? (
                          <input type="number" value={item.actual_count}
                            onChange={(e) => setScopeItems(scopeItems.map(i => i.id === item.id ? { ...i, actual_count: Number(e.target.value) } : i))}
                            className="w-16 px-2 py-1 border border-slate-200 rounded text-center text-sm"
                          />
                        ) : (
                          <span className={`text-sm font-medium ${item.actual_count > item.planned_count ? 'text-red-500' : 'text-slate-900'}`}>
                            {item.actual_count}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editMode ? (
                          <input type="text" value={item.notes} placeholder="Notes..."
                            onChange={(e) => setScopeItems(scopeItems.map(i => i.id === item.id ? { ...i, notes: e.target.value } : i))}
                            className="w-full px-2 py-1 border border-slate-200 rounded text-xs"
                          />
                        ) : (
                          item.notes && <span className="text-xs text-slate-400 italic">{item.notes}</span>
                        )}
                      </td>
                      {editMode && (
                        <td className="px-4 py-3">
                          <button onClick={() => removeScopeItem(item.id)} className="text-slate-400 hover:text-red-500">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          {/* Retrospective */}
          <Card>
            <CardHeader title="Retrospective" />
            <div className="space-y-5">
              {editMode ? (
                <>
                  <Textarea label="What went well" value={formData.went_well || ''} onChange={(v) => setFormData({ ...formData, went_well: v })} rows={3} />
                  <Textarea label="What went wrong" value={formData.went_wrong || ''} onChange={(v) => setFormData({ ...formData, went_wrong: v })} rows={3} />
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <Checkbox label="Scope Creep?" checked={formData.scope_creep || false} onChange={(v) => setFormData({ ...formData, scope_creep: v })} />
                    {formData.scope_creep && (
                      <Textarea value={formData.scope_creep_notes || ''} onChange={(v) => setFormData({ ...formData, scope_creep_notes: v })} placeholder="Describe..." rows={2} className="mt-3" />
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">What went well</label>
                    <p className="text-sm text-slate-600">{project.went_well || <span className="text-slate-400 italic">Not documented</span>}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">What went wrong</label>
                    <p className="text-sm text-slate-600">{project.went_wrong || <span className="text-slate-400 italic">Not documented</span>}</p>
                  </div>
                  {project.scope_creep && (
                    <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-red-500">⚠</span>
                        <span className="font-semibold text-red-700 text-sm">Scope Creep</span>
                      </div>
                      <p className="text-sm text-red-700">{project.scope_creep_notes || 'No details'}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </Card>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Project Info */}
          <Card>
            <CardHeader title="Project Info" />
            {editMode ? (
              <div className="space-y-4">
                <Input label="Client" value={formData.client || ''} onChange={(v) => setFormData({ ...formData, client: v })} />
                <Input label="Type" value={formData.project_type || ''} onChange={(v) => setFormData({ ...formData, project_type: v })} />
                <Input label="CMS" value={formData.cms || ''} onChange={(v) => setFormData({ ...formData, cms: v })} />
                <Input label="Integrations" value={formData.integrations || ''} onChange={(v) => setFormData({ ...formData, integrations: v })} />
                <Input label="Base Offer (€)" type="number" value={formData.offer_value || 0} onChange={(v) => setFormData({ ...formData, offer_value: Number(v) })} />
                <Input label="Est. Margin (%)" type="number" value={formData.estimated_profit_margin || 0} onChange={(v) => setFormData({ ...formData, estimated_profit_margin: Number(v) })} />
                <Select label="Status" value={formData.status || 'draft'} onChange={(v) => setFormData({ ...formData, status: v as 'draft' | 'active' | 'completed' })} options={STATUS_OPTIONS} />
              </div>
            ) : (
              <div className="space-y-2">
                {[
                  { label: 'Client', value: project.client },
                  { label: 'Type', value: project.project_type },
                  { label: 'CMS', value: project.cms },
                  { label: 'Integrations', value: project.integrations },
                  { label: 'Base Offer', value: `€${project.offer_value.toLocaleString()}` },
                  { label: 'Est. Margin', value: `${project.estimated_profit_margin}%` },
                ].map((item, i) => (
                  <div key={i} className="flex justify-between py-2 border-b border-slate-100 last:border-0">
                    <span className="text-sm text-slate-500">{item.label}</span>
                    <span className="text-sm font-medium text-slate-900">{item.value || '-'}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Change Requests */}
          <Card>
            <CardHeader title="Change Requests" action={editMode && <Button variant="ghost" size="sm" onClick={addChangeRequest}><Plus className="w-3 h-3" /> Add</Button>} />
            {changeRequests.length === 0 ? (
              <p className="text-sm text-slate-400">No change requests</p>
            ) : (
              <div className="space-y-2">
                {changeRequests.map((cr) => (
                  <div key={cr.id} className="flex justify-between items-center py-2 border-b border-slate-100 last:border-0">
                    <span className="text-sm text-slate-700">{cr.description}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-emerald-500">+€{cr.amount.toLocaleString()}</span>
                      {editMode && (
                        <button onClick={() => removeChangeRequest(cr.id)} className="text-slate-400 hover:text-red-500">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                <div className="flex justify-between pt-2 border-t-2 border-slate-200">
                  <span className="text-sm font-semibold">Total CRs</span>
                  <span className="text-sm font-bold text-emerald-500">+€{crTotal.toLocaleString()}</span>
                </div>
              </div>
            )}
          </Card>

          {/* External Costs */}
          <Card>
            <CardHeader title="External Costs" action={editMode && <Button variant="ghost" size="sm" onClick={addExternalCost}><Plus className="w-3 h-3" /> Add</Button>} />
            {externalCosts.length === 0 ? (
              <p className="text-sm text-slate-400">No external costs</p>
            ) : (
              <div className="space-y-3">
                {externalCosts.map((cost) => (
                  <div key={cost.id} className="py-2 border-b border-slate-100 last:border-0">
                    <div className="flex justify-between items-center mb-1">
                      {editMode ? (
                        <input type="text" value={cost.description}
                          onChange={(e) => setExternalCosts(externalCosts.map(c => c.id === cost.id ? { ...c, description: e.target.value } : c))}
                          className="flex-1 px-2 py-1 border border-slate-200 rounded text-sm mr-2"
                        />
                      ) : (
                        <span className="text-sm text-slate-700">{cost.description}</span>
                      )}
                      {editMode && (
                        <button onClick={() => removeExternalCost(cost.id)} className="text-slate-400 hover:text-red-500">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {editMode ? (
                        <>
                          <input type="number" value={cost.estimated_cost}
                            onChange={(e) => setExternalCosts(externalCosts.map(c => c.id === cost.id ? { ...c, estimated_cost: Number(e.target.value) } : c))}
                            className="w-20 px-2 py-1 border border-slate-200 rounded text-sm text-right"
                          />
                          <span className="text-slate-300">→</span>
                          <input type="number" value={cost.actual_cost}
                            onChange={(e) => setExternalCosts(externalCosts.map(c => c.id === cost.id ? { ...c, actual_cost: Number(e.target.value) } : c))}
                            className="w-20 px-2 py-1 border border-slate-200 rounded text-sm text-right"
                          />
                        </>
                      ) : (
                        <span className="text-sm">
                          <span className="text-slate-500">€{cost.estimated_cost.toLocaleString()}</span>
                          <span className="text-slate-300 mx-1">→</span>
                          <span className={cost.actual_cost > cost.estimated_cost ? 'text-red-500 font-medium' : 'text-emerald-500 font-medium'}>
                            €{cost.actual_cost.toLocaleString()}
                          </span>
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                <div className="flex justify-between pt-2 border-t-2 border-slate-200">
                  <span className="text-sm font-semibold">Total</span>
                  <span className="text-sm font-semibold">
                    <span className="text-slate-500">€{metrics.estimatedExternalCost.toLocaleString()}</span>
                    <span className="text-slate-300 mx-1">→</span>
                    <span className={metrics.actualExternalCost > metrics.estimatedExternalCost ? 'text-red-500' : 'text-emerald-500'}>
                      €{metrics.actualExternalCost.toLocaleString()}
                    </span>
                  </span>
                </div>
              </div>
            )}
          </Card>

          {/* Danger Zone */}
          {editMode && (
            <Card className="border-red-200 bg-red-50">
              <CardHeader title="Danger Zone" />
              <Button variant="danger" size="sm" onClick={handleDelete}>
                <Trash2 className="w-4 h-4" /> Delete Project
              </Button>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
