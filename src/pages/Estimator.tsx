import { useState, useEffect } from 'react';
import { Calculator, Upload, FileText, AlertTriangle, TrendingUp, X, ThumbsUp, ThumbsDown } from 'lucide-react';
import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
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

interface EstimateResponse {
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
  risks: string[];
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
  const [scopeItems, setScopeItems] = useState({
    pages: 0,
    components: 0,
    templates: 0,
    integrations: 0,
    wireframes: 0,
  });

  // Result state
  const [estimate, setEstimate] = useState<EstimateResponse | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [savedEstimateId, setSavedEstimateId] = useState<string | null>(null);

  useEffect(() => {
    loadHistoricalData();
  }, []);

  async function loadHistoricalData() {
    try {
      const [projects, analytics] = await Promise.all([
        fetchProjectsWithMetrics(),
        fetchAnalyticsData(),
      ]);

      // Build historical data summary
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

      // Build profile stats
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
          scope_items: scopeItems,
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
        setShowModal(true);

        // Save estimate to database
        const { data: savedEstimate } = await supabase
          .from('ai_estimates')
          .insert([{
            brief_text: briefText,
            project_type: projectType,
            cms,
            integrations,
            scope_items: scopeItems,
            estimate_result: data.estimate,
            suggested_price: data.estimate.suggested_price?.realistic,
            confidence: data.estimate.confidence,
            risks: data.estimate.risks,
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
        // Parse Word document
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        setBriefText(result.value);
      } else if (file.name.toLowerCase().endsWith('.pdf')) {
        // Parse PDF document
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
        // Plain text files
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
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Project Estimator</h1>
        <p className="text-sm text-slate-500 mt-1">
          AI-powered estimates based on your historical project data
        </p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Input Form */}
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
              placeholder="Paste the project brief or description here..."
              rows={8}
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
                placeholder="e.g., Stripe, Mailchimp, API"
              />
            </div>
          </Card>

          {/* Scope Items */}
          <Card>
            <h2 className="text-base font-semibold text-slate-900 mb-4">Scope Items (Estimated)</h2>
            <div className="grid grid-cols-5 gap-4">
              <Input
                label="Pages"
                type="number"
                value={scopeItems.pages}
                onChange={(v) => setScopeItems({ ...scopeItems, pages: Number(v) })}
              />
              <Input
                label="Components"
                type="number"
                value={scopeItems.components}
                onChange={(v) => setScopeItems({ ...scopeItems, components: Number(v) })}
              />
              <Input
                label="Templates"
                type="number"
                value={scopeItems.templates}
                onChange={(v) => setScopeItems({ ...scopeItems, templates: Number(v) })}
              />
              <Input
                label="Integrations"
                type="number"
                value={scopeItems.integrations}
                onChange={(v) => setScopeItems({ ...scopeItems, integrations: Number(v) })}
              />
              <Input
                label="Wireframes"
                type="number"
                value={scopeItems.wireframes}
                onChange={(v) => setScopeItems({ ...scopeItems, wireframes: Number(v) })}
              />
            </div>
          </Card>

          {/* Generate Button */}
          <Button
            onClick={handleEstimate}
            disabled={loading || !briefText.trim()}
            className="w-full py-4"
          >
            {loading ? (
              <>
                <span className="animate-spin mr-2">&#9696;</span> Generating Estimate...
              </>
            ) : (
              <>
                <Calculator className="w-4 h-4" /> Generate Estimate
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
                  The AI analyzes your brief and compares it to your historical projects to generate realistic estimates.
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

      {/* Results Modal */}
      {showModal && estimate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 sticky top-0 bg-white">
              <h2 className="text-xl font-bold text-slate-900">Estimate Results</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {/* Confidence & Summary */}
              <div className="flex items-center gap-4">
                <div className={`px-4 py-2 rounded-full text-sm font-semibold ${
                  estimate.confidence === 'high'
                    ? 'bg-emerald-100 text-emerald-700'
                    : estimate.confidence === 'medium'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-red-100 text-red-700'
                }`}>
                  {estimate.confidence?.toUpperCase()} CONFIDENCE
                </div>
                <p className="text-sm text-slate-500">Based on analysis of similar past projects</p>
              </div>

              {/* Hours Table */}
              <Card padding={false}>
                <div className="px-6 py-4 border-b border-slate-200">
                  <h3 className="font-semibold text-slate-900">Hours by Profile</h3>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Profile</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-emerald-600 uppercase">Optimistic</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-blue-600 uppercase">Realistic</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-amber-600 uppercase">Pessimistic</th>
                    </tr>
                  </thead>
                  <tbody>
                    {PROFILES.map((profile) => {
                      const hours = estimate.profiles[profile];
                      if (!hours || (hours.optimistic === 0 && hours.realistic === 0)) return null;
                      return (
                        <tr key={profile} className="border-b border-slate-100">
                          <td className="px-6 py-3 font-medium text-slate-900">{profile}</td>
                          <td className="px-4 py-3 text-center text-emerald-600">{hours.optimistic}h</td>
                          <td className="px-4 py-3 text-center text-blue-600 font-semibold">{hours.realistic}h</td>
                          <td className="px-4 py-3 text-center text-amber-600">{hours.pessimistic}h</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 border-t-2 border-slate-200">
                      <td className="px-6 py-3 font-bold text-slate-900">TOTAL</td>
                      <td className="px-4 py-3 text-center font-bold text-emerald-600">{estimate.total.optimistic}h</td>
                      <td className="px-4 py-3 text-center font-bold text-blue-600">{estimate.total.realistic}h</td>
                      <td className="px-4 py-3 text-center font-bold text-amber-600">{estimate.total.pessimistic}h</td>
                    </tr>
                  </tfoot>
                </table>
              </Card>

              {/* Suggested Pricing */}
              <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                  <h3 className="font-semibold text-slate-900">Suggested Pricing (at ~52% margin)</h3>
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
              </Card>

              {/* Risks */}
              {estimate.risks && estimate.risks.length > 0 && (
                <Card className="bg-amber-50 border-amber-200">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                    <h3 className="font-semibold text-amber-900">Risk Factors</h3>
                  </div>
                  <ul className="space-y-2">
                    {estimate.risks.map((risk, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-amber-800">
                        <span className="text-amber-500 mt-1">•</span>
                        {risk}
                      </li>
                    ))}
                  </ul>
                </Card>
              )}

              {/* Reasoning */}
              {estimate.reasoning && (
                <Card>
                  <h3 className="font-semibold text-slate-900 mb-2">AI Reasoning</h3>
                  <p className="text-sm text-slate-600">{estimate.reasoning}</p>
                </Card>
              )}

              {/* Feedback */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                <span className="text-sm text-slate-500">Was this estimate helpful?</span>
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
          </div>
        </div>
      )}
    </div>
  );
}
