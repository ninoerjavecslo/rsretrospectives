import { useState, useEffect } from 'react';
import { ListTodo, Sparkles, History, BookTemplate, FolderSearch, Download, Copy, Check, Trash2, AlertTriangle, ChevronDown, ChevronRight, Save, Upload } from 'lucide-react';
import { Button, Card, Input, Textarea, LoadingSpinner } from '../components/ui';
import { supabase } from '../lib/supabase';

// Types
interface JiraTask {
  summary: string;
  description: string;
  task_type: 'Epic' | 'Story' | 'Task' | 'Subtask';
  priority: 'Highest' | 'High' | 'Medium' | 'Low' | 'Lowest';
  labels: string[];
  story_points?: number;
  acceptance_criteria?: string[];
  parent_ref?: string;
  order: number;
}

interface GenerationResult {
  tasks: JiraTask[];
  summary: {
    total_tasks: number;
    by_type: Record<string, number>;
    by_priority: Record<string, number>;
    estimated_story_points: number;
  };
  recommendations: string[];
}

interface Generation {
  id: string;
  created_at: string;
  project_name: string;
  project_brief: string | null;
  tasks: JiraTask[];
  summary: GenerationResult['summary'] | null;
}

interface Template {
  id: string;
  name: string;
  description: string | null;
  tasks: JiraTask[];
  project_type: string | null;
}

// Tab types
type TabType = 'generate' | 'history' | 'templates' | 'reference';

// Priority colors
const PRIORITY_COLORS: Record<string, string> = {
  Highest: 'bg-red-100 text-red-700 border-red-200',
  High: 'bg-orange-100 text-orange-700 border-orange-200',
  Medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  Low: 'bg-blue-100 text-blue-700 border-blue-200',
  Lowest: 'bg-slate-100 text-slate-600 border-slate-200',
};

// Task type colors
const TYPE_COLORS: Record<string, string> = {
  Epic: 'bg-purple-100 text-purple-700',
  Story: 'bg-green-100 text-green-700',
  Task: 'bg-blue-100 text-blue-700',
  Subtask: 'bg-slate-100 text-slate-600',
};

export function PMHelper() {
  const [activeTab, setActiveTab] = useState<TabType>('generate');

  // Generate tab state
  const [projectName, setProjectName] = useState('');
  const [projectBrief, setProjectBrief] = useState('');
  const [scopeItems, setScopeItems] = useState('');
  const [selectedTemplates, setSelectedTemplates] = useState('');
  const [customInstructions, setCustomInstructions] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [editedTasks, setEditedTasks] = useState<JiraTask[]>([]);
  const [copiedCSV, setCopiedCSV] = useState(false);
  const [expandedTasks, setExpandedTasks] = useState<Set<number>>(new Set());

  // History tab state
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Templates tab state
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);

  useEffect(() => {
    if (activeTab === 'history') {
      loadGenerations();
    } else if (activeTab === 'templates') {
      loadTemplates();
    }
  }, [activeTab]);

  async function loadGenerations() {
    setLoadingHistory(true);
    try {
      const { data } = await supabase
        .from('pm_generations')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (data) {
        setGenerations(data);
      }
    } catch (error) {
      console.error('Error loading generations:', error);
    }
    setLoadingHistory(false);
  }

  async function loadTemplates() {
    setLoadingTemplates(true);
    try {
      const { data } = await supabase
        .from('pm_templates')
        .select('*')
        .order('name');

      if (data) {
        setTemplates(data);
      }
    } catch (error) {
      console.error('Error loading templates:', error);
    }
    setLoadingTemplates(false);
  }

  async function generateTasks() {
    if (!projectName.trim() || !projectBrief.trim()) return;

    setLoading(true);
    setResult(null);
    setEditedTasks([]);

    try {
      const response = await fetch('/.netlify/functions/pm-generate-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_name: projectName,
          project_brief: projectBrief,
          scope_items: scopeItems.split('\n').filter(s => s.trim()),
          selected_templates: selectedTemplates.split('\n').filter(s => s.trim()),
          custom_instructions: customInstructions,
        }),
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      if (data.result) {
        setResult(data.result);
        setEditedTasks(data.result.tasks || []);
      }
    } catch (error) {
      console.error('Error generating tasks:', error);
    }

    setLoading(false);
  }

  async function saveGeneration() {
    if (!result || editedTasks.length === 0) return;

    try {
      const { error } = await supabase
        .from('pm_generations')
        .insert([{
          project_name: projectName,
          project_brief: projectBrief,
          tasks: editedTasks,
          summary: result.summary,
        }]);

      if (error) throw error;

      // Reload history if on history tab
      if (activeTab === 'history') {
        loadGenerations();
      }
    } catch (error) {
      console.error('Error saving generation:', error);
    }
  }

  async function saveAsTemplate() {
    if (!newTemplateName.trim() || editedTasks.length === 0) return;

    try {
      const { error } = await supabase
        .from('pm_templates')
        .insert([{
          name: newTemplateName,
          description: projectBrief.substring(0, 200),
          tasks: editedTasks,
          project_type: null,
        }]);

      if (error) throw error;

      setNewTemplateName('');
      setShowSaveTemplate(false);
      loadTemplates();
    } catch (error) {
      console.error('Error saving template:', error);
    }
  }

  async function deleteGeneration(id: string) {
    try {
      await supabase.from('pm_generations').delete().eq('id', id);
      setGenerations(prev => prev.filter(g => g.id !== id));
    } catch (error) {
      console.error('Error deleting generation:', error);
    }
  }

  async function deleteTemplate(id: string) {
    try {
      await supabase.from('pm_templates').delete().eq('id', id);
      setTemplates(prev => prev.filter(t => t.id !== id));
    } catch (error) {
      console.error('Error deleting template:', error);
    }
  }

  function loadFromGeneration(gen: Generation) {
    setProjectName(gen.project_name);
    setProjectBrief(gen.project_brief || '');
    setEditedTasks(gen.tasks);
    setResult({
      tasks: gen.tasks,
      summary: gen.summary || {
        total_tasks: gen.tasks.length,
        by_type: {},
        by_priority: {},
        estimated_story_points: 0,
      },
      recommendations: [],
    });
    setActiveTab('generate');
  }

  function loadFromTemplate(template: Template) {
    setEditedTasks(template.tasks);
    setResult({
      tasks: template.tasks,
      summary: {
        total_tasks: template.tasks.length,
        by_type: {},
        by_priority: {},
        estimated_story_points: 0,
      },
      recommendations: [],
    });
    setActiveTab('generate');
  }

  function toggleTaskExpansion(index: number) {
    setExpandedTasks(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  function updateTask(index: number, updates: Partial<JiraTask>) {
    setEditedTasks(prev => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates };
      return next;
    });
  }

  function removeTask(index: number) {
    setEditedTasks(prev => prev.filter((_, i) => i !== index));
  }

  function generateCSV(): string {
    const headers = ['Summary', 'Description', 'Issue Type', 'Priority', 'Labels', 'Story Points', 'Acceptance Criteria'];
    const rows = editedTasks.map(task => [
      task.summary,
      task.description,
      task.task_type,
      task.priority,
      task.labels.join(', '),
      task.story_points?.toString() || '',
      task.acceptance_criteria?.join('\n') || '',
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(','))
      .join('\n');

    return csvContent;
  }

  function copyCSV() {
    const csv = generateCSV();
    navigator.clipboard.writeText(csv);
    setCopiedCSV(true);
    setTimeout(() => setCopiedCSV(false), 2000);
  }

  function downloadCSV() {
    const csv = generateCSV();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName || 'jira-tasks'}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const tabs = [
    { id: 'generate' as const, label: 'Generate', icon: Sparkles },
    { id: 'history' as const, label: 'History', icon: History },
    { id: 'templates' as const, label: 'Templates', icon: BookTemplate },
    { id: 'reference' as const, label: 'Reference', icon: FolderSearch },
  ];

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <ListTodo className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">PM Helper</h1>
            <p className="text-slate-600">Generate Jira-ready task breakdowns from project briefs</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-lg w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Generate Tab */}
      {activeTab === 'generate' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Panel */}
          <div className="space-y-4">
            <Card className="p-6">
              <h3 className="text-sm font-semibold text-slate-900 mb-4">Project Details</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Project Name *
                  </label>
                  <Input
                    value={projectName}
                    onChange={setProjectName}
                    placeholder="e.g., ACME Corp Website Redesign"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Project Brief *
                  </label>
                  <Textarea
                    value={projectBrief}
                    onChange={setProjectBrief}
                    placeholder="Describe the project scope, goals, and requirements..."
                    rows={6}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Scope Items (one per line)
                  </label>
                  <Textarea
                    value={scopeItems}
                    onChange={setScopeItems}
                    placeholder="Homepage&#10;Product listing&#10;Product detail&#10;Contact form&#10;Blog"
                    rows={4}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Templates/Pages to Build (one per line)
                  </label>
                  <Textarea
                    value={selectedTemplates}
                    onChange={setSelectedTemplates}
                    placeholder="Homepage&#10;Category page&#10;Product page&#10;About us&#10;Contact"
                    rows={4}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Custom Instructions (optional)
                  </label>
                  <Textarea
                    value={customInstructions}
                    onChange={setCustomInstructions}
                    placeholder="Any specific requirements or preferences..."
                    rows={2}
                  />
                </div>

                <Button
                  onClick={generateTasks}
                  disabled={loading || !projectName.trim() || !projectBrief.trim()}
                  className="w-full"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Generate Tasks
                    </>
                  )}
                </Button>
              </div>
            </Card>
          </div>

          {/* Results Panel */}
          <div className="space-y-4">
            {result && (
              <>
                {/* Summary */}
                <Card className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-slate-900">Summary</h3>
                    <div className="flex gap-2">
                      <Button variant="secondary" size="sm" onClick={() => setShowSaveTemplate(true)}>
                        <BookTemplate className="w-4 h-4" />
                        Save as Template
                      </Button>
                      <Button variant="secondary" size="sm" onClick={saveGeneration}>
                        <Save className="w-4 h-4" />
                        Save
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-4 mb-4">
                    <div className="text-center p-3 bg-slate-50 rounded-lg">
                      <div className="text-2xl font-bold text-slate-900">{editedTasks.length}</div>
                      <div className="text-xs text-slate-500">Tasks</div>
                    </div>
                    <div className="text-center p-3 bg-purple-50 rounded-lg">
                      <div className="text-2xl font-bold text-purple-700">
                        {editedTasks.filter(t => t.task_type === 'Epic').length}
                      </div>
                      <div className="text-xs text-slate-500">Epics</div>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <div className="text-2xl font-bold text-green-700">
                        {editedTasks.filter(t => t.task_type === 'Story').length}
                      </div>
                      <div className="text-xs text-slate-500">Stories</div>
                    </div>
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-700">
                        {editedTasks.reduce((sum, t) => sum + (t.story_points || 0), 0)}
                      </div>
                      <div className="text-xs text-slate-500">Story Points</div>
                    </div>
                  </div>

                  {result.recommendations && result.recommendations.length > 0 && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                        <span className="text-sm font-medium text-amber-700">Recommendations</span>
                      </div>
                      <ul className="text-sm text-amber-700 space-y-1">
                        {result.recommendations.map((rec, i) => (
                          <li key={i}>• {rec}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </Card>

                {/* Save as Template Modal */}
                {showSaveTemplate && (
                  <Card className="p-4 border-2 border-indigo-200 bg-indigo-50">
                    <h4 className="text-sm font-medium text-slate-900 mb-2">Save as Template</h4>
                    <div className="flex gap-2">
                      <Input
                        value={newTemplateName}
                        onChange={setNewTemplateName}
                        placeholder="Template name..."
                        className="flex-1"
                      />
                      <Button size="sm" onClick={saveAsTemplate}>Save</Button>
                      <Button variant="secondary" size="sm" onClick={() => setShowSaveTemplate(false)}>Cancel</Button>
                    </div>
                  </Card>
                )}

                {/* Export Actions */}
                <Card className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-700">Export for Jira</span>
                    <div className="flex gap-2">
                      <Button variant="secondary" size="sm" onClick={copyCSV}>
                        {copiedCSV ? (
                          <>
                            <Check className="w-4 h-4" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" />
                            Copy CSV
                          </>
                        )}
                      </Button>
                      <Button size="sm" onClick={downloadCSV}>
                        <Download className="w-4 h-4" />
                        Download CSV
                      </Button>
                    </div>
                  </div>
                </Card>

                {/* Task List */}
                <Card className="p-4">
                  <h3 className="text-sm font-semibold text-slate-900 mb-4">
                    Tasks ({editedTasks.length})
                  </h3>

                  <div className="space-y-2 max-h-[600px] overflow-y-auto">
                    {editedTasks.map((task, index) => (
                      <div
                        key={index}
                        className="border border-slate-200 rounded-lg overflow-hidden"
                      >
                        <div
                          className="flex items-center gap-3 p-3 bg-white cursor-pointer hover:bg-slate-50"
                          onClick={() => toggleTaskExpansion(index)}
                        >
                          {expandedTasks.has(index) ? (
                            <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                          )}

                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${TYPE_COLORS[task.task_type] || 'bg-slate-100'}`}>
                            {task.task_type}
                          </span>

                          <span className="flex-1 text-sm font-medium text-slate-900 truncate">
                            {task.summary}
                          </span>

                          <span className={`px-2 py-0.5 rounded text-xs border ${PRIORITY_COLORS[task.priority] || 'bg-slate-100'}`}>
                            {task.priority}
                          </span>

                          {task.story_points && (
                            <span className="px-2 py-0.5 bg-slate-100 rounded text-xs font-medium text-slate-600">
                              {task.story_points} SP
                            </span>
                          )}

                          <button
                            onClick={(e) => { e.stopPropagation(); removeTask(index); }}
                            className="p-1 text-slate-400 hover:text-red-500"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {expandedTasks.has(index) && (
                          <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-3">
                            <div>
                              <label className="block text-xs font-medium text-slate-500 mb-1">Summary</label>
                              <Input
                                value={task.summary}
                                onChange={(value) => updateTask(index, { summary: value })}
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-slate-500 mb-1">Description</label>
                              <Textarea
                                value={task.description}
                                onChange={(value) => updateTask(index, { description: value })}
                                rows={3}
                              />
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                              <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">Type</label>
                                <select
                                  value={task.task_type}
                                  onChange={(e) => updateTask(index, { task_type: e.target.value as JiraTask['task_type'] })}
                                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                                >
                                  <option value="Epic">Epic</option>
                                  <option value="Story">Story</option>
                                  <option value="Task">Task</option>
                                  <option value="Subtask">Subtask</option>
                                </select>
                              </div>

                              <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">Priority</label>
                                <select
                                  value={task.priority}
                                  onChange={(e) => updateTask(index, { priority: e.target.value as JiraTask['priority'] })}
                                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                                >
                                  <option value="Highest">Highest</option>
                                  <option value="High">High</option>
                                  <option value="Medium">Medium</option>
                                  <option value="Low">Low</option>
                                  <option value="Lowest">Lowest</option>
                                </select>
                              </div>

                              <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">Story Points</label>
                                <Input
                                  type="number"
                                  value={task.story_points || ''}
                                  onChange={(value) => updateTask(index, { story_points: parseInt(value) || undefined })}
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-slate-500 mb-1">Labels (comma-separated)</label>
                              <Input
                                value={task.labels.join(', ')}
                                onChange={(value) => updateTask(index, { labels: value.split(',').map((l: string) => l.trim()).filter(Boolean) })}
                              />
                            </div>

                            {task.acceptance_criteria && task.acceptance_criteria.length > 0 && (
                              <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">Acceptance Criteria</label>
                                <Textarea
                                  value={task.acceptance_criteria.join('\n')}
                                  onChange={(value) => updateTask(index, { acceptance_criteria: value.split('\n').filter(Boolean) })}
                                  rows={3}
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              </>
            )}

            {!result && !loading && (
              <Card className="p-12 text-center">
                <ListTodo className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">Enter project details and click Generate to create tasks</p>
              </Card>
            )}

            {loading && (
              <Card className="p-12 text-center">
                <LoadingSpinner />
                <p className="text-slate-700 font-medium">Generating tasks...</p>
                <p className="text-sm text-slate-500">AI is creating your project breakdown</p>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div>
          {loadingHistory ? (
            <Card className="p-12 text-center">
              <LoadingSpinner />
            </Card>
          ) : generations.length === 0 ? (
            <Card className="p-12 text-center">
              <History className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">No saved generations yet</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {generations.map((gen) => (
                <Card key={gen.id} className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-medium text-slate-900 truncate flex-1">{gen.project_name}</h4>
                    <button
                      onClick={() => deleteGeneration(gen.id)}
                      className="p-1 text-slate-400 hover:text-red-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 mb-3">
                    {new Date(gen.created_at).toLocaleDateString()} • {gen.tasks.length} tasks
                  </p>
                  {gen.project_brief && (
                    <p className="text-sm text-slate-600 line-clamp-2 mb-3">{gen.project_brief}</p>
                  )}
                  <Button variant="secondary" size="sm" onClick={() => loadFromGeneration(gen)} className="w-full">
                    <Upload className="w-4 h-4" />
                    Load
                  </Button>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Templates Tab */}
      {activeTab === 'templates' && (
        <div>
          {loadingTemplates ? (
            <Card className="p-12 text-center">
              <LoadingSpinner />
            </Card>
          ) : templates.length === 0 ? (
            <Card className="p-12 text-center">
              <BookTemplate className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">No templates saved yet</p>
              <p className="text-sm text-slate-400 mt-1">Generate tasks and save them as templates</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map((template) => (
                <Card key={template.id} className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-medium text-slate-900 truncate flex-1">{template.name}</h4>
                    <button
                      onClick={() => deleteTemplate(template.id)}
                      className="p-1 text-slate-400 hover:text-red-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 mb-3">
                    {template.tasks.length} tasks
                    {template.project_type && ` • ${template.project_type}`}
                  </p>
                  {template.description && (
                    <p className="text-sm text-slate-600 line-clamp-2 mb-3">{template.description}</p>
                  )}
                  <Button variant="secondary" size="sm" onClick={() => loadFromTemplate(template)} className="w-full">
                    <Upload className="w-4 h-4" />
                    Use Template
                  </Button>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Reference Tab */}
      {activeTab === 'reference' && (
        <Card className="p-12 text-center">
          <FolderSearch className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500">Reference projects feature coming soon</p>
          <p className="text-sm text-slate-400 mt-1">This will show tasks from completed projects for reference</p>
        </Card>
      )}
    </div>
  );
}
