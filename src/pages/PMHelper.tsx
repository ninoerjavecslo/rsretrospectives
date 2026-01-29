import { useState, useEffect, useRef } from 'react';
import { ListTodo, Sparkles, History, BookTemplate, Download, Copy, Check, Trash2, AlertTriangle, ChevronDown, ChevronRight, Save, Upload, FileText, Square, CheckSquare, ArrowLeft } from 'lucide-react';
import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';
import { Button, Card, Input, Textarea, LoadingSpinner } from '../components/ui';
import { supabase } from '../lib/supabase';

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

// Types
interface JiraTask {
  summary: string;
  description: string;
  task_type: 'Epic' | 'Story' | 'Task' | 'Subtask';
  priority: 'Highest' | 'High' | 'Medium' | 'Low' | 'Lowest';
  labels: string[];
  parent_ref?: string;
  order: number;
}

interface GenerationResult {
  tasks: JiraTask[];
  summary: {
    total_tasks: number;
    by_type: Record<string, number>;
    by_priority: Record<string, number>;
  };
  recommendations: string[];
  detected_project_name?: string;
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
type TabType = 'generate' | 'history' | 'templates';

// Language options
type Language = 'en' | 'sl';

// Export fields
interface ExportFields {
  summary: boolean;
  description: boolean;
  issueType: boolean;
  priority: boolean;
}

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Generate tab state
  const [offerText, setOfferText] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [language, setLanguage] = useState<Language>('en');
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [editedTasks, setEditedTasks] = useState<JiraTask[]>([]);
  const [selectedTasks, setSelectedTasks] = useState<Set<number>>(new Set());
  const [copiedCSV, setCopiedCSV] = useState(false);
  const [expandedTasks, setExpandedTasks] = useState<Set<number>>(new Set());
  const [projectName, setProjectName] = useState('');

  // Export fields selection
  const [exportFields, setExportFields] = useState<ExportFields>({
    summary: true,
    description: true,
    issueType: true,
    priority: true,
  });

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

  // Select all tasks when results come in
  useEffect(() => {
    if (editedTasks.length > 0) {
      setSelectedTasks(new Set(editedTasks.map((_, i) => i)));
    }
  }, [editedTasks.length]);

  async function handleFileUpload(file: File) {
    setParsing(true);
    setFileName(file.name);

    try {
      let text = '';

      if (file.name.toLowerCase().endsWith('.docx')) {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        text = result.value;
      } else if (file.name.toLowerCase().endsWith('.pdf')) {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .map((item) => ('str' in item ? item.str : ''))
            .join(' ');
          text += pageText + '\n\n';
        }
      } else {
        text = await file.text();
      }

      setOfferText(text);
    } catch (error) {
      console.error('Error parsing file:', error);
      alert('Failed to parse file. Please try again or paste the text directly.');
    }

    setParsing(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  }

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
    if (!offerText.trim()) return;

    setLoading(true);
    setResult(null);
    setEditedTasks([]);
    setSelectedTasks(new Set());

    try {
      // Step 1: Start the job
      const startResponse = await fetch('/.netlify/functions/pm-generate-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offer_text: offerText,
          additional_notes: additionalNotes,
          language,
        }),
      });

      const startData = await startResponse.json();

      if (startData.error) {
        throw new Error(startData.error);
      }

      if (!startData.job_id) {
        throw new Error('Failed to start job');
      }

      // Step 2: Poll for results
      const jobId = startData.job_id;
      let attempts = 0;
      const maxAttempts = 60; // 60 seconds max for detailed generation

      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
        attempts++;

        const pollResponse = await fetch('/.netlify/functions/pm-generate-tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ job_id: jobId }),
        });

        const pollData = await pollResponse.json();

        if (pollData.status === 'completed' && pollData.result) {
          setResult(pollData.result);
          setEditedTasks(pollData.result.tasks || []);
          if (pollData.result.detected_project_name) {
            setProjectName(pollData.result.detected_project_name);
          }
          setLoading(false);
          return;
        }

        if (pollData.status === 'error') {
          throw new Error(pollData.error || 'Job failed');
        }

        // Still pending, continue polling
      }

      throw new Error('Timeout waiting for results');
    } catch (error) {
      console.error('Error generating tasks:', error);
      alert('Failed to generate tasks. Please try again.');
      setLoading(false);
    }
  }

  async function saveGeneration() {
    if (!result || editedTasks.length === 0) return;

    try {
      const { error } = await supabase
        .from('pm_generations')
        .insert([{
          project_name: projectName || 'Untitled Project',
          project_brief: offerText.substring(0, 500),
          tasks: editedTasks,
          summary: result.summary,
        }]);

      if (error) throw error;
      alert('Saved!');

      if (activeTab === 'history') {
        loadGenerations();
      }
    } catch (error) {
      console.error('Error saving generation:', error);
      alert(`Failed to save: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async function saveAsTemplate() {
    if (!newTemplateName.trim() || editedTasks.length === 0) return;

    try {
      const { error } = await supabase
        .from('pm_templates')
        .insert([{
          name: newTemplateName,
          description: offerText.substring(0, 200),
          tasks: editedTasks,
          project_type: null,
        }]);

      if (error) throw error;

      setNewTemplateName('');
      setShowSaveTemplate(false);
      loadTemplates();
    } catch (error) {
      console.error('Error saving template:', error);
      alert(`Failed to save template: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
    setOfferText(gen.project_brief || '');
    setEditedTasks(gen.tasks);
    setResult({
      tasks: gen.tasks,
      summary: gen.summary || {
        total_tasks: gen.tasks.length,
        by_type: {},
        by_priority: {},
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

  function toggleTaskSelection(index: number) {
    setSelectedTasks(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  function selectAllTasks() {
    setSelectedTasks(new Set(editedTasks.map((_, i) => i)));
  }

  function deselectAllTasks() {
    setSelectedTasks(new Set());
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
    setSelectedTasks(prev => {
      const next = new Set<number>();
      prev.forEach(i => {
        if (i < index) next.add(i);
        else if (i > index) next.add(i - 1);
      });
      return next;
    });
  }

  function generateCSV(): string {
    const headers: string[] = [];
    if (exportFields.summary) headers.push('Summary');
    if (exportFields.description) headers.push('Description');
    if (exportFields.issueType) headers.push('Issue Type');
    if (exportFields.priority) headers.push('Priority');

    const selectedTasksArray = editedTasks.filter((_, i) => selectedTasks.has(i));
    const rows = selectedTasksArray.map(task => {
      const row: string[] = [];
      if (exportFields.summary) row.push(task.summary);
      if (exportFields.description) row.push(task.description);
      if (exportFields.issueType) row.push(task.task_type);
      if (exportFields.priority) row.push(task.priority);
      return row;
    });

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(','))
      .join('\n');

    return csvContent;
  }

  function copyCSV() {
    if (selectedTasks.size === 0) {
      alert('Select at least one task to export');
      return;
    }
    const csv = generateCSV();
    navigator.clipboard.writeText(csv);
    setCopiedCSV(true);
    setTimeout(() => setCopiedCSV(false), 2000);
  }

  function downloadCSV() {
    if (selectedTasks.size === 0) {
      alert('Select at least one task to export');
      return;
    }
    const csv = generateCSV();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName || 'jira-tasks'}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadWord() {
    if (selectedTasks.size === 0) {
      alert('Select at least one task to export');
      return;
    }

    const selectedTasksArray = editedTasks.filter((_, i) => selectedTasks.has(i));

    // Generate HTML content that Word can open
    let html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
      <head>
        <meta charset="utf-8">
        <title>${projectName || 'Jira Tasks'}</title>
        <style>
          body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; }
          h1 { font-size: 18pt; color: #1e293b; margin-bottom: 20px; }
          h2 { font-size: 14pt; color: #334155; margin-top: 20px; margin-bottom: 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; }
          .task { margin-bottom: 20px; padding: 10px; border: 1px solid #e2e8f0; border-radius: 4px; }
          .task-header { font-weight: bold; font-size: 12pt; margin-bottom: 8px; }
          .task-meta { color: #64748b; font-size: 10pt; margin-bottom: 8px; }
          .task-description { white-space: pre-wrap; font-size: 10pt; }
          .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 9pt; margin-right: 8px; }
          .epic { background: #f3e8ff; color: #7c3aed; }
          .story { background: #dcfce7; color: #16a34a; }
          .task-type { background: #dbeafe; color: #2563eb; }
          .subtask { background: #f1f5f9; color: #475569; }
          .highest { background: #fee2e2; color: #dc2626; }
          .high { background: #ffedd5; color: #ea580c; }
          .medium { background: #fef3c7; color: #ca8a04; }
          .low { background: #dbeafe; color: #2563eb; }
        </style>
      </head>
      <body>
        <h1>${projectName || 'Project Tasks'}</h1>
        <p>Generated: ${new Date().toLocaleDateString()}</p>
        <p>Total tasks: ${selectedTasksArray.length}</p>
    `;

    // Group tasks by type
    const epics = selectedTasksArray.filter(t => t.task_type === 'Epic');
    const stories = selectedTasksArray.filter(t => t.task_type === 'Story');
    const tasks = selectedTasksArray.filter(t => t.task_type === 'Task');
    const subtasks = selectedTasksArray.filter(t => t.task_type === 'Subtask');

    const addTasksSection = (title: string, taskList: JiraTask[], typeClass: string) => {
      if (taskList.length === 0) return;
      html += `<h2>${title} (${taskList.length})</h2>`;
      taskList.forEach(task => {
        html += `
          <div class="task">
            <div class="task-header">${task.summary}</div>
            <div class="task-meta">
              <span class="badge ${typeClass}">${task.task_type}</span>
              <span class="badge ${task.priority.toLowerCase()}">${task.priority}</span>
            </div>
            ${exportFields.description ? `<div class="task-description">${task.description.replace(/\n/g, '<br>')}</div>` : ''}
          </div>
        `;
      });
    };

    addTasksSection('Epics', epics, 'epic');
    addTasksSection('Stories', stories, 'story');
    addTasksSection('Tasks', tasks, 'task-type');
    addTasksSection('Subtasks', subtasks, 'subtask');

    html += '</body></html>';

    const blob = new Blob([html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName || 'jira-tasks'}-${new Date().toISOString().split('T')[0]}.doc`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function resetForm() {
    setOfferText('');
    setAdditionalNotes('');
    setFileName(null);
    setResult(null);
    setEditedTasks([]);
    setSelectedTasks(new Set());
    setProjectName('');
  }

  function backToInput() {
    setResult(null);
    setEditedTasks([]);
    setSelectedTasks(new Set());
  }

  const tabs = [
    { id: 'generate' as const, label: 'Generate', icon: Sparkles },
    { id: 'history' as const, label: 'History', icon: History },
    { id: 'templates' as const, label: 'Templates', icon: BookTemplate },
  ];

  // Check if we should show full-width results
  const showFullWidthResults = result && editedTasks.length > 0;

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
            <p className="text-slate-600">Upload offer, AI generates Jira tasks</p>
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
        <>
          {/* Input Form - shown when no results */}
          {!showFullWidthResults && !loading && (
            <div className="max-w-2xl">
              <Card className="p-6">
                <h3 className="text-sm font-semibold text-slate-900 mb-4">Upload Offer</h3>

                {/* Language Selection */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Output Language</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setLanguage('en')}
                      className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                        language === 'en'
                          ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      English
                    </button>
                    <button
                      onClick={() => setLanguage('sl')}
                      className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                        language === 'sl'
                          ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      Slovenian
                    </button>
                  </div>
                </div>

                {/* File Upload */}
                <div
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                  className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-indigo-400 hover:bg-indigo-50/50 transition-colors cursor-pointer mb-4"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {parsing ? (
                    <div className="flex flex-col items-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-2" />
                      <p className="text-slate-600">Parsing document...</p>
                    </div>
                  ) : fileName ? (
                    <div className="flex flex-col items-center">
                      <FileText className="w-10 h-10 text-indigo-500 mb-2" />
                      <p className="text-slate-900 font-medium">{fileName}</p>
                      <p className="text-xs text-slate-500 mt-1">Click to replace</p>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                      <p className="text-slate-700 font-medium">Drop offer file here</p>
                      <p className="text-sm text-slate-500">PDF, Word, or text</p>
                    </>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.docx,.txt,.md"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(file);
                    }}
                    className="hidden"
                  />
                </div>

                {/* Or paste text */}
                <div className="relative mb-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-white px-2 text-slate-500">or paste offer text</span>
                  </div>
                </div>

                <Textarea
                  value={offerText}
                  onChange={setOfferText}
                  placeholder="Paste your offer/brief content here..."
                  rows={6}
                />

                {/* Additional Notes */}
                <div className="mt-4">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Additional Notes (optional)
                  </label>
                  <Textarea
                    value={additionalNotes}
                    onChange={setAdditionalNotes}
                    placeholder="Any extra instructions, focus areas, or context..."
                    rows={3}
                  />
                </div>

                <div className="flex gap-2 mt-4">
                  <Button
                    onClick={generateTasks}
                    disabled={loading || !offerText.trim()}
                    className="flex-1"
                  >
                    <Sparkles className="w-4 h-4" />
                    Generate Tasks
                  </Button>
                  {offerText && (
                    <Button variant="secondary" onClick={resetForm}>
                      Clear
                    </Button>
                  )}
                </div>
              </Card>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="max-w-2xl">
              <Card className="p-12 text-center">
                <LoadingSpinner />
                <p className="text-slate-700 font-medium mt-4">Generating detailed tasks...</p>
                <p className="text-sm text-slate-500">AI is creating 40-70 specific tasks for each page and feature</p>
                <p className="text-xs text-slate-400 mt-2">This may take up to 60 seconds</p>
              </Card>
            </div>
          )}

          {/* Full-width Results */}
          {showFullWidthResults && (
            <div className="space-y-6">
              {/* Header with back button */}
              <div className="flex items-center justify-between">
                <Button variant="secondary" onClick={backToInput}>
                  <ArrowLeft className="w-4 h-4" />
                  Back to Input
                </Button>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setShowSaveTemplate(true)}>
                    <BookTemplate className="w-4 h-4" />
                    Save as Template
                  </Button>
                  <Button size="sm" onClick={saveGeneration}>
                    <Save className="w-4 h-4" />
                    Save to History
                  </Button>
                </div>
              </div>

              {/* Summary Row */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="p-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-slate-900">{editedTasks.length}</div>
                    <div className="text-sm text-slate-500">Total Tasks</div>
                  </div>
                </Card>
                <Card className="p-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-purple-600">
                      {editedTasks.filter(t => t.task_type === 'Epic').length}
                    </div>
                    <div className="text-sm text-slate-500">Epics</div>
                  </div>
                </Card>
                <Card className="p-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-600">
                      {editedTasks.filter(t => t.task_type === 'Story').length}
                    </div>
                    <div className="text-sm text-slate-500">Stories</div>
                  </div>
                </Card>
                <Card className="p-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-blue-600">
                      {editedTasks.filter(t => t.task_type === 'Task' || t.task_type === 'Subtask').length}
                    </div>
                    <div className="text-sm text-slate-500">Tasks/Subtasks</div>
                  </div>
                </Card>
              </div>

              {/* Recommendations */}
              {result?.recommendations && result.recommendations.length > 0 && (
                <Card className="p-4 bg-amber-50 border-amber-200">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    <span className="text-sm font-medium text-amber-700">Recommendations</span>
                  </div>
                  <ul className="text-sm text-amber-700 space-y-1">
                    {result.recommendations.map((rec, i) => (
                      <li key={i}>• {rec}</li>
                    ))}
                  </ul>
                </Card>
              )}

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

              {/* Export Section */}
              <Card className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 mb-2">Export Options</h3>
                    <div className="flex flex-wrap gap-4">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={exportFields.summary}
                          onChange={(e) => setExportFields(f => ({ ...f, summary: e.target.checked }))}
                          className="rounded border-slate-300"
                        />
                        Summary
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={exportFields.description}
                          onChange={(e) => setExportFields(f => ({ ...f, description: e.target.checked }))}
                          className="rounded border-slate-300"
                        />
                        Description
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={exportFields.issueType}
                          onChange={(e) => setExportFields(f => ({ ...f, issueType: e.target.checked }))}
                          className="rounded border-slate-300"
                        />
                        Issue Type
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={exportFields.priority}
                          onChange={(e) => setExportFields(f => ({ ...f, priority: e.target.checked }))}
                          className="rounded border-slate-300"
                        />
                        Priority
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-500">{selectedTasks.size} selected</span>
                    <Button variant="secondary" size="sm" onClick={copyCSV}>
                      {copiedCSV ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      {copiedCSV ? 'Copied!' : 'Copy CSV'}
                    </Button>
                    <Button variant="secondary" size="sm" onClick={downloadCSV}>
                      <Download className="w-4 h-4" />
                      CSV
                    </Button>
                    <Button size="sm" onClick={downloadWord}>
                      <Download className="w-4 h-4" />
                      Word
                    </Button>
                  </div>
                </div>
              </Card>

              {/* Task List - Full Width */}
              <Card className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-slate-900">
                    Tasks ({editedTasks.length})
                  </h3>
                  <div className="flex gap-2">
                    <button
                      onClick={selectAllTasks}
                      className="text-xs text-indigo-600 hover:text-indigo-700"
                    >
                      Select all
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      onClick={deselectAllTasks}
                      className="text-xs text-slate-500 hover:text-slate-700"
                    >
                      Deselect all
                    </button>
                  </div>
                </div>

                <div className="space-y-2 max-h-[70vh] overflow-y-auto">
                  {editedTasks.map((task, index) => (
                    <div
                      key={index}
                      className={`border rounded-lg overflow-hidden ${
                        selectedTasks.has(index) ? 'border-indigo-300 bg-indigo-50/30' : 'border-slate-200'
                      }`}
                    >
                      <div
                        className="flex items-center gap-3 p-3 bg-white cursor-pointer hover:bg-slate-50"
                      >
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleTaskSelection(index); }}
                          className="shrink-0"
                        >
                          {selectedTasks.has(index) ? (
                            <CheckSquare className="w-5 h-5 text-indigo-600" />
                          ) : (
                            <Square className="w-5 h-5 text-slate-300" />
                          )}
                        </button>

                        <div
                          className="flex items-center gap-3 flex-1 min-w-0"
                          onClick={() => toggleTaskExpansion(index)}
                        >
                          {expandedTasks.has(index) ? (
                            <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                          )}

                          <span className={`px-2 py-0.5 rounded text-xs font-medium shrink-0 ${TYPE_COLORS[task.task_type] || 'bg-slate-100'}`}>
                            {task.task_type}
                          </span>

                          <span className="flex-1 text-sm font-medium text-slate-900 truncate">
                            {task.summary}
                          </span>

                          <span className={`px-2 py-0.5 rounded text-xs border shrink-0 ${PRIORITY_COLORS[task.priority] || 'bg-slate-100'}`}>
                            {task.priority}
                          </span>
                        </div>

                        <button
                          onClick={(e) => { e.stopPropagation(); removeTask(index); }}
                          className="p-1 text-slate-400 hover:text-red-500 shrink-0"
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
                              rows={6}
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-3">
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
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}
        </>
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
    </div>
  );
}
