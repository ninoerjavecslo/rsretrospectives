import { useState, useEffect } from 'react';
import { Calculator, Upload, FileText, AlertTriangle, TrendingUp, ThumbsUp, ThumbsDown, Copy, Check, Sparkles, HelpCircle, Layout, ChevronDown, ChevronRight, Download, History, Trash2 } from 'lucide-react';
import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
import { Button, Card, Input, Textarea, Select, LoadingSpinner } from '../components/ui';
import { fetchProjectsWithMetrics, fetchAnalyticsData, supabase, TARGET_MARGIN_MIN, INTERNAL_HOURLY_COST } from '../lib/supabase';
import type { Profile } from '../types';

const PROJECT_TYPES = [
  { value: '', label: 'Select type...' },
  { value: 'website', label: 'Website' },
  { value: 'web_app', label: 'Web Application' },
  { value: 'ecommerce', label: 'E-commerce' },
  { value: 'mobile_app', label: 'Mobile App' },
  { value: 'branding', label: 'Branding' },
  { value: 'other', label: 'Other' },
];

const CMS_OPTIONS = [
  { value: '', label: 'Select CMS...' },
  { value: 'wordpress', label: 'WordPress' },
  { value: 'webflow', label: 'Webflow' },
  { value: 'shopify', label: 'Shopify' },
  { value: 'payload', label: 'Payload' },
  { value: 'statamic', label: 'Statamic' },
  { value: 'umbraco', label: 'Umbraco' },
  { value: 'adobe_aem', label: 'Adobe AEM' },
  { value: 'custom', label: 'Custom' },
  { value: 'headless', label: 'Headless CMS (Other)' },
  { value: 'none', label: 'None' },
];

const PROFILES: Profile[] = ['UX', 'UI', 'DESIGN', 'DEV', 'PM', 'CONTENT', 'ANALYTICS'];

interface Template {
  name: string;
  name_en: string;
  included: boolean;
  description: string;
}

interface Question {
  question: string;
  question_en: string;
  why: string;
}

interface Risk {
  risk: string;
  risk_en: string;
  severity: 'low' | 'medium' | 'high';
}

interface EstimateResponse {
  suggested_templates: Template[];
  client_questions: {
    content: Question[];
    functionality: Question[];
    design: Question[];
    technical: Question[];
  };
  risks: Risk[];
  profiles: {
    [key: string]: {
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
  suggested_price: {
    optimistic: number;
    realistic: number;
    pessimistic: number;
  };
  confidence: 'low' | 'medium' | 'high';
  reasoning: string;
}

export function Estimator() {
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [historicalData, setHistoricalData] = useState<string>('');
  const [profileStats, setProfileStats] = useState<string>('');

  // Form state
  const [briefText, setBriefText] = useState('');
  const [projectType, setProjectType] = useState('');
  const [cms, setCms] = useState('');
  const [integrations, setIntegrations] = useState('');

  // Result state
  const [estimate, setEstimate] = useState<EstimateResponse | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [savedEstimateId, setSavedEstimateId] = useState<string | null>(null);
  const [copiedQuestions, setCopiedQuestions] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    templates: true,
    questions: true,
    risks: true,
    hours: true,
  });

  // History state
  const [showHistory, setShowHistory] = useState(false);
  const [estimateHistory, setEstimateHistory] = useState<Array<{
    id: string;
    created_at: string;
    brief_text: string | null;
    project_type: string | null;
    cms: string | null;
    estimate_result: EstimateResponse | null;
    suggested_price: number | null;
    confidence: string | null;
  }>>([]);

  useEffect(() => {
    loadHistoricalData();
    loadEstimateHistory();
  }, []);

  async function loadEstimateHistory() {
    try {
      const { data } = await supabase
        .from('ai_estimates')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (data) {
        setEstimateHistory(data);
      }
    } catch (error) {
      console.error('Error loading estimate history:', error);
    }
  }

  function loadFromHistory(saved: typeof estimateHistory[0]) {
    if (saved.estimate_result) {
      setEstimate(saved.estimate_result);
      setTemplates(saved.estimate_result.suggested_templates || []);
      setSavedEstimateId(saved.id);
      setBriefText(saved.brief_text || '');
      setProjectType(saved.project_type || '');
      setCms(saved.cms || '');
      setShowHistory(false);
    }
  }

  async function deleteFromHistory(id: string) {
    if (!confirm('Delete this estimate from history?')) return;

    try {
      await supabase.from('ai_estimates').delete().eq('id', id);
      setEstimateHistory(prev => prev.filter(e => e.id !== id));
    } catch (error) {
      console.error('Error deleting estimate:', error);
    }
  }

  function exportToPDF() {
    if (!estimate) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPos = 20;

    // Title
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('Project Estimate', pageWidth / 2, yPos, { align: 'center' });
    yPos += 10;

    // Date and confidence
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth / 2, yPos, { align: 'center' });
    yPos += 5;
    doc.text(`Confidence: ${estimate.confidence?.toUpperCase() || 'N/A'}`, pageWidth / 2, yPos, { align: 'center' });
    yPos += 15;

    // Project details
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Project Details', 14, yPos);
    yPos += 7;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    if (projectType) doc.text(`Type: ${projectType}`, 14, yPos), yPos += 5;
    if (cms) doc.text(`CMS: ${cms}`, 14, yPos), yPos += 5;
    if (integrations) doc.text(`Integrations: ${integrations}`, 14, yPos), yPos += 5;
    yPos += 5;

    // Templates
    const includedTemplates = templates.filter(t => t.included);
    if (includedTemplates.length > 0) {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Suggested Templates', 14, yPos);
      yPos += 7;

      autoTable(doc, {
        startY: yPos,
        head: [['Template', 'Description']],
        body: includedTemplates.map(t => [t.name_en || t.name, t.description]),
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246] },
        margin: { left: 14 },
      });
      yPos = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
    }

    // Risks
    if (estimate.risks && estimate.risks.length > 0) {
      if (yPos > 240) { doc.addPage(); yPos = 20; }
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Potential Risks', 14, yPos);
      yPos += 7;

      autoTable(doc, {
        startY: yPos,
        head: [['Severity', 'Risk']],
        body: estimate.risks.map(r => [r.severity.toUpperCase(), r.risk_en || r.risk]),
        theme: 'striped',
        headStyles: { fillColor: [245, 158, 11] },
        margin: { left: 14 },
      });
      yPos = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
    }

    // Hour estimates
    if (yPos > 200) { doc.addPage(); yPos = 20; }
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Hour Estimates by Profile', 14, yPos);
    yPos += 7;

    const hoursData = PROFILES
      .filter(p => estimate.profiles[p] && (estimate.profiles[p].realistic > 0 || estimate.profiles[p].optimistic > 0))
      .map(p => [
        p,
        `${estimate.profiles[p].optimistic}h`,
        `${estimate.profiles[p].realistic}h`,
        `${estimate.profiles[p].pessimistic}h`,
      ]);

    hoursData.push([
      'TOTAL',
      `${estimate.total.optimistic}h`,
      `${estimate.total.realistic}h`,
      `${estimate.total.pessimistic}h`,
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['Profile', 'Optimistic', 'Realistic', 'Pessimistic']],
      body: hoursData,
      theme: 'striped',
      headStyles: { fillColor: [16, 185, 129] },
      margin: { left: 14 },
      foot: [],
    });
    yPos = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

    // Pricing
    if (yPos > 240) { doc.addPage(); yPos = 20; }
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Suggested Pricing (52% margin)', 14, yPos);
    yPos += 7;

    autoTable(doc, {
      startY: yPos,
      head: [['Scenario', 'Price']],
      body: [
        ['Optimistic', `€${estimate.suggested_price?.optimistic?.toLocaleString() || 0}`],
        ['Realistic', `€${estimate.suggested_price?.realistic?.toLocaleString() || 0}`],
        ['Pessimistic', `€${estimate.suggested_price?.pessimistic?.toLocaleString() || 0}`],
      ],
      theme: 'striped',
      headStyles: { fillColor: [99, 102, 241] },
      margin: { left: 14 },
    });
    yPos = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

    // Reasoning
    if (estimate.reasoning) {
      if (yPos > 240) { doc.addPage(); yPos = 20; }
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('AI Reasoning', 14, yPos);
      yPos += 7;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const splitReasoning = doc.splitTextToSize(estimate.reasoning, pageWidth - 28);
      doc.text(splitReasoning, 14, yPos);
    }

    // Save
    const filename = `estimate_${projectType || 'project'}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(filename);
  }

  async function loadHistoricalData() {
    try {
      const [projects, analytics] = await Promise.all([
        fetchProjectsWithMetrics(),
        fetchAnalyticsData(),
      ]);

      const similarProjects = projects.map(p => ({
        name: p.name,
        type: p.project_type,
        cms: p.cms,
        value: p.metrics.totalValue,
        hours: p.metrics.actualHours,
        margin: p.metrics.actualMargin,
        hoursVariance: p.metrics.hoursVariancePercent,
        profileHours: Object.fromEntries(
          p.profile_hours.map(ph => [ph.profile, { est: ph.estimated_hours, act: ph.actual_hours }])
        ),
      }));

      setHistoricalData(JSON.stringify(similarProjects, null, 2));

      const stats = Object.entries(analytics.profileStats).map(([profile, data]) => ({
        profile,
        estimated: data.estimated,
        actual: data.actual,
        variance: data.estimated > 0
          ? ((data.actual - data.estimated) / data.estimated * 100).toFixed(0) + '%'
          : 'N/A',
      }));

      setProfileStats(JSON.stringify(stats, null, 2));
    } catch (error) {
      console.error('Error loading historical data:', error);
    } finally {
      setLoadingData(false);
    }
  }

  async function handleEstimate() {
    setLoading(true);
    setEstimate(null);

    try {
      const response = await fetch('/.netlify/functions/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brief_text: briefText,
          project_type: projectType,
          cms,
          integrations,
          historicalData,
          profileStats,
        }),
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      if (data.estimate) {
        setEstimate(data.estimate);
        setTemplates(data.estimate.suggested_templates || []);

        // Save estimate to database
        const { data: savedEstimate } = await supabase
          .from('ai_estimates')
          .insert([{
            brief_text: briefText,
            project_type: projectType,
            cms,
            integrations,
            estimate_result: data.estimate,
            suggested_price: data.estimate.suggested_price?.realistic,
            confidence: data.estimate.confidence,
            risks: data.estimate.risks?.map((r: Risk) => r.risk) || [],
          }])
          .select()
          .single();

        if (savedEstimate) {
          setSavedEstimateId(savedEstimate.id);
        }
      }
    } catch (error) {
      console.error('Estimate error:', error);
      alert('Failed to generate estimate. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleFeedback(feedback: 'good' | 'bad' | 'neutral') {
    if (!savedEstimateId) return;

    try {
      await supabase
        .from('ai_estimates')
        .update({ user_feedback: feedback })
        .eq('id', savedEstimateId);
    } catch (error) {
      console.error('Error saving feedback:', error);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      if (file.name.toLowerCase().endsWith('.docx')) {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        setBriefText(result.value);
      } else if (file.name.toLowerCase().endsWith('.pdf')) {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .map((item) => ('str' in item ? item.str : ''))
            .join(' ');
          fullText += pageText + '\n\n';
        }
        setBriefText(fullText.trim());
      } else {
        const reader = new FileReader();
        reader.onload = (event) => {
          const text = event.target?.result as string;
          setBriefText(text);
        };
        reader.readAsText(file);
      }
    } catch (error) {
      console.error('Error reading file:', error);
      alert('Error reading file. Please try a different file or paste the text directly.');
    }
  }

  function copyQuestionsToClipboard() {
    if (!estimate?.client_questions) return;

    const categories = [
      { name: 'Content & Structure', questions: estimate.client_questions.content },
      { name: 'Functionality', questions: estimate.client_questions.functionality },
      { name: 'Design', questions: estimate.client_questions.design },
      { name: 'Technical', questions: estimate.client_questions.technical },
    ];

    const text = categories
      .filter(c => c.questions?.length > 0)
      .map(c => `${c.name}:\n${c.questions.map(q => `• ${q.question}`).join('\n')}`)
      .join('\n\n');

    navigator.clipboard.writeText(text);
    setCopiedQuestions(true);
    setTimeout(() => setCopiedQuestions(false), 2000);
  }

  function toggleTemplate(index: number) {
    setTemplates(prev => prev.map((t, i) =>
      i === index ? { ...t, included: !t.included } : t
    ));
  }

  function toggleSection(section: keyof typeof expandedSections) {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  }

  if (loadingData) {
    return (
      <div className="p-8">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Project Estimator</h1>
          <p className="text-sm text-slate-500 mt-1">
            AI-powered project analysis with templates, questions, risks, and estimates
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={() => setShowHistory(!showHistory)}
          className={showHistory ? 'bg-blue-100 text-blue-700' : ''}
        >
          <History className="w-4 h-4" />
          History ({estimateHistory.length})
        </Button>
      </div>

      {/* History Panel */}
      {showHistory && (
        <Card className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-slate-900">Previous Estimates</h3>
            <button onClick={() => setShowHistory(false)} className="text-slate-400 hover:text-slate-600">
              ×
            </button>
          </div>
          {estimateHistory.length === 0 ? (
            <p className="text-sm text-slate-500">No saved estimates yet.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {estimateHistory.map((saved) => (
                <div
                  key={saved.id}
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 cursor-pointer group"
                  onClick={() => loadFromHistory(saved)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-900 truncate">
                        {saved.project_type || 'Unknown type'}
                      </span>
                      {saved.cms && (
                        <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded">
                          {saved.cms}
                        </span>
                      )}
                      {saved.confidence && (
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          saved.confidence === 'high' ? 'bg-emerald-100 text-emerald-700' :
                          saved.confidence === 'medium' ? 'bg-amber-100 text-amber-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {saved.confidence}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-slate-500">
                        {new Date(saved.created_at).toLocaleDateString()} {new Date(saved.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {saved.suggested_price && (
                        <span className="text-xs font-medium text-blue-600">
                          €{saved.suggested_price.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteFromHistory(saved.id); }}
                    className="p-1 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Input Section */}
      {!estimate && (
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 space-y-6">
            {/* Brief Input */}
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-slate-900">Project Brief</h2>
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept=".txt,.md,.docx,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <span className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700">
                    <Upload className="w-4 h-4" /> Upload file
                  </span>
                </label>
              </div>
              <Textarea
                value={briefText}
                onChange={setBriefText}
                placeholder="Paste the project brief, RFP, or description here..."
                rows={10}
              />
            </Card>

            {/* Project Details */}
            <Card>
              <h2 className="text-base font-semibold text-slate-900 mb-4">Project Details</h2>
              <div className="grid grid-cols-3 gap-4">
                <Select
                  label="Project Type"
                  value={projectType}
                  onChange={setProjectType}
                  options={PROJECT_TYPES}
                />
                <Select
                  label="CMS"
                  value={cms}
                  onChange={setCms}
                  options={CMS_OPTIONS}
                />
                <Input
                  label="Integrations"
                  value={integrations}
                  onChange={setIntegrations}
                  placeholder="e.g., Stripe, Salesforce, API"
                />
              </div>
            </Card>

            {/* Generate Button */}
            <Button
              onClick={handleEstimate}
              disabled={loading || !briefText.trim()}
              className="w-full py-4 text-base"
            >
              {loading ? (
                <>
                  <span className="animate-spin mr-2">&#9696;</span> Analyzing project...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" /> Analyze Project
                </>
              )}
            </Button>
          </div>

          {/* Info Panel */}
          <div className="space-y-6">
            <Card className="bg-blue-50 border-blue-200">
              <div className="flex items-start gap-3">
                <FileText className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-blue-900 mb-1">How it works</h3>
                  <p className="text-sm text-blue-700">
                    AI analyzes your brief and provides: suggested templates, questions for client,
                    potential risks, and hour estimates based on your historical data.
                  </p>
                </div>
              </div>
            </Card>

            <Card>
              <h3 className="font-semibold text-slate-900 mb-3">Your Data</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Historical Projects</span>
                  <span className="font-medium">{historicalData ? JSON.parse(historicalData).length : 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Target Margin</span>
                  <span className="font-medium">{TARGET_MARGIN_MIN}-55%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Internal Cost</span>
                  <span className="font-medium">€{INTERNAL_HOURLY_COST}/h</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Results Section */}
      {estimate && (
        <div className="space-y-6">
          {/* Back button and actions */}
          <div className="flex items-center justify-between">
            <Button variant="secondary" onClick={() => setEstimate(null)}>
              ← Back to Input
            </Button>
            <div className="flex items-center gap-3">
              <Button variant="secondary" onClick={exportToPDF}>
                <Download className="w-4 h-4" /> Export PDF
              </Button>
              <div className={`px-4 py-2 rounded-full text-sm font-semibold ${
                estimate.confidence === 'high'
                  ? 'bg-emerald-100 text-emerald-700'
                  : estimate.confidence === 'medium'
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-red-100 text-red-700'
              }`}>
                {estimate.confidence?.toUpperCase()} CONFIDENCE
              </div>
            </div>
          </div>

          {/* Suggested Templates */}
          <Card>
            <button
              onClick={() => toggleSection('templates')}
              className="w-full flex items-center justify-between mb-4"
            >
              <div className="flex items-center gap-2">
                <Layout className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-semibold text-slate-900">Suggested Templates</h3>
                <span className="text-sm text-slate-500">({templates.filter(t => t.included).length} selected)</span>
              </div>
              {expandedSections.templates ? <ChevronDown className="w-5 h-5 text-slate-400" /> : <ChevronRight className="w-5 h-5 text-slate-400" />}
            </button>
            {expandedSections.templates && (
              <div className="grid grid-cols-2 gap-3">
                {templates.map((template, i) => (
                  <div
                    key={i}
                    onClick={() => toggleTemplate(i)}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      template.included
                        ? 'bg-blue-50 border-blue-300'
                        : 'bg-slate-50 border-slate-200 opacity-60'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={template.included}
                        onChange={() => {}}
                        className="w-4 h-4 mt-1 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <div className="font-medium text-slate-900">{template.name}</div>
                        <div className="text-xs text-slate-500">{template.description}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Client Questions */}
          <Card>
            <button
              onClick={() => toggleSection('questions')}
              className="w-full flex items-center justify-between mb-4"
            >
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-purple-600" />
                <h3 className="text-base font-semibold text-slate-900">Questions for Client</h3>
              </div>
              <div className="flex items-center gap-2">
                {expandedSections.questions && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); copyQuestionsToClipboard(); }}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded"
                  >
                    {copiedQuestions ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    {copiedQuestions ? 'Copied!' : 'Copy all'}
                  </button>
                )}
                {expandedSections.questions ? <ChevronDown className="w-5 h-5 text-slate-400" /> : <ChevronRight className="w-5 h-5 text-slate-400" />}
              </div>
            </button>
            {expandedSections.questions && estimate.client_questions && (
              <div className="grid grid-cols-2 gap-6">
                {[
                  { key: 'content', label: 'Content & Structure', icon: '📄' },
                  { key: 'functionality', label: 'Functionality', icon: '⚙️' },
                  { key: 'design', label: 'Design', icon: '🎨' },
                  { key: 'technical', label: 'Technical', icon: '🔧' },
                ].map(({ key, label, icon }) => {
                  const questions = estimate.client_questions[key as keyof typeof estimate.client_questions];
                  if (!questions?.length) return null;
                  return (
                    <div key={key}>
                      <h4 className="font-medium text-slate-700 mb-2 flex items-center gap-2">
                        <span>{icon}</span> {label}
                      </h4>
                      <ul className="space-y-2">
                        {questions.map((q, i) => (
                          <li key={i} className="text-sm">
                            <div className="text-slate-900">• {q.question}</div>
                            <div className="text-xs text-slate-400 ml-3">{q.why}</div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Risks */}
          {estimate.risks && estimate.risks.length > 0 && (
            <Card className="bg-amber-50 border-amber-200">
              <button
                onClick={() => toggleSection('risks')}
                className="w-full flex items-center justify-between mb-4"
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                  <h3 className="text-base font-semibold text-amber-900">Potential Risks</h3>
                </div>
                {expandedSections.risks ? <ChevronDown className="w-5 h-5 text-amber-600" /> : <ChevronRight className="w-5 h-5 text-amber-600" />}
              </button>
              {expandedSections.risks && (
                <div className="space-y-2">
                  {estimate.risks.map((risk, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        risk.severity === 'high' ? 'bg-red-100 text-red-700' :
                        risk.severity === 'medium' ? 'bg-amber-100 text-amber-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {risk.severity}
                      </span>
                      <span className="text-sm text-amber-800">{risk.risk}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {/* Hour Estimates */}
          <Card>
            <button
              onClick={() => toggleSection('hours')}
              className="w-full flex items-center justify-between mb-4"
            >
              <div className="flex items-center gap-2">
                <Calculator className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-semibold text-slate-900">Hour Estimates</h3>
              </div>
              {expandedSections.hours ? <ChevronDown className="w-5 h-5 text-slate-400" /> : <ChevronRight className="w-5 h-5 text-slate-400" />}
            </button>
            {expandedSections.hours && (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Profile</th>
                        <th className="px-4 py-2 text-center text-xs font-semibold text-emerald-600 uppercase">Optimistic</th>
                        <th className="px-4 py-2 text-center text-xs font-semibold text-blue-600 uppercase">Realistic</th>
                        <th className="px-4 py-2 text-center text-xs font-semibold text-amber-600 uppercase">Pessimistic</th>
                      </tr>
                    </thead>
                    <tbody>
                      {PROFILES.map((profile) => {
                        const hours = estimate.profiles[profile];
                        if (!hours || (hours.optimistic === 0 && hours.realistic === 0)) return null;
                        return (
                          <tr key={profile} className="border-b border-slate-100">
                            <td className="px-4 py-2 font-medium text-slate-900">{profile}</td>
                            <td className="px-4 py-2 text-center text-emerald-600">{hours.optimistic}h</td>
                            <td className="px-4 py-2 text-center text-blue-600 font-semibold">{hours.realistic}h</td>
                            <td className="px-4 py-2 text-center text-amber-600">{hours.pessimistic}h</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-50 border-t-2 border-slate-200">
                        <td className="px-4 py-2 font-bold text-slate-900">TOTAL</td>
                        <td className="px-4 py-2 text-center font-bold text-emerald-600">{estimate.total.optimistic}h</td>
                        <td className="px-4 py-2 text-center font-bold text-blue-600">{estimate.total.realistic}h</td>
                        <td className="px-4 py-2 text-center font-bold text-amber-600">{estimate.total.pessimistic}h</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Pricing */}
                <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl">
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="w-5 h-5 text-blue-600" />
                    <h4 className="font-semibold text-slate-900">Suggested Price (52% margin)</h4>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-white rounded-xl">
                      <div className="text-xs text-emerald-600 font-semibold mb-1">OPTIMISTIC</div>
                      <div className="text-2xl font-bold text-slate-900">
                        €{estimate.suggested_price?.optimistic?.toLocaleString()}
                      </div>
                    </div>
                    <div className="text-center p-4 bg-white rounded-xl ring-2 ring-blue-500">
                      <div className="text-xs text-blue-600 font-semibold mb-1">REALISTIC</div>
                      <div className="text-2xl font-bold text-blue-600">
                        €{estimate.suggested_price?.realistic?.toLocaleString()}
                      </div>
                    </div>
                    <div className="text-center p-4 bg-white rounded-xl">
                      <div className="text-xs text-amber-600 font-semibold mb-1">PESSIMISTIC</div>
                      <div className="text-2xl font-bold text-slate-900">
                        €{estimate.suggested_price?.pessimistic?.toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </Card>

          {/* Reasoning */}
          {estimate.reasoning && (
            <Card>
              <h3 className="font-semibold text-slate-900 mb-2">AI Reasoning</h3>
              <p className="text-sm text-slate-600">{estimate.reasoning}</p>
            </Card>
          )}

          {/* Feedback */}
          <div className="flex items-center justify-between pt-4">
            <span className="text-sm text-slate-500">Was this analysis helpful?</span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => handleFeedback('good')}>
                <ThumbsUp className="w-4 h-4" /> Helpful
              </Button>
              <Button variant="ghost" size="sm" onClick={() => handleFeedback('bad')}>
                <ThumbsDown className="w-4 h-4" /> Not helpful
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
