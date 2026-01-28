import { useState, useRef } from 'react';
import { X, Upload, Loader2, AlertTriangle, CheckCircle } from 'lucide-react';
import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';
import { Button } from './ui';
import type { ParsedOffer, Profile } from '../types';

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface OfferImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (data: ParsedOffer) => void;
}

const PROFILES: Profile[] = ['UX', 'UI', 'DESIGN', 'DEV', 'PM', 'CONTENT', 'ANALYTICS'];

export function OfferImportModal({ isOpen, onClose, onApply }: OfferImportModalProps) {
  const [step, setStep] = useState<'upload' | 'parsing' | 'preview'>('upload');
  const [error, setError] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<ParsedOffer | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  async function handleFileUpload(file: File) {
    setError(null);
    setStep('parsing');

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

      // Send to AI for parsing
      const response = await fetch('/.netlify/functions/parse-offer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offer_text: text }),
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      if (!data.parsed) {
        throw new Error('Failed to parse offer');
      }

      setParsedData(data.parsed);
      setStep('preview');
    } catch (err) {
      console.error('Error parsing offer:', err);
      setError(err instanceof Error ? err.message : 'Failed to parse offer');
      setStep('upload');
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  }

  function handleClose() {
    setStep('upload');
    setError(null);
    setParsedData(null);
    onClose();
  }

  function handleApply() {
    if (parsedData) {
      onApply(parsedData);
      handleClose();
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Import from Offer</h2>
            <p className="text-sm text-slate-500">AI will extract project details from your offer document</p>
          </div>
          <button onClick={handleClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 'upload' && (
            <div>
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <span className="text-sm text-red-700">{error}</span>
                </div>
              )}

              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                className="border-2 border-dashed border-slate-300 rounded-xl p-12 text-center hover:border-blue-400 hover:bg-blue-50/50 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-700 font-medium mb-1">Drop your offer file here</p>
                <p className="text-sm text-slate-500 mb-4">or click to browse</p>
                <p className="text-xs text-slate-400">Supports PDF, Word (.docx), and text files</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                  }}
                  className="hidden"
                />
              </div>
            </div>
          )}

          {step === 'parsing' && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
              <p className="text-slate-700 font-medium">Parsing offer...</p>
              <p className="text-sm text-slate-500">AI is extracting project details</p>
            </div>
          )}

          {step === 'preview' && parsedData && (
            <div className="space-y-6">
              {/* Warnings */}
              {parsedData.warnings && parsedData.warnings.length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    <span className="text-sm font-medium text-amber-700">Notes from AI</span>
                  </div>
                  <ul className="text-sm text-amber-700 space-y-1">
                    {parsedData.warnings.map((w, i) => (
                      <li key={i}>• {w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Confidence */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600">Confidence:</span>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  parsedData.confidence === 'high' ? 'bg-emerald-100 text-emerald-700' :
                  parsedData.confidence === 'medium' ? 'bg-amber-100 text-amber-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {parsedData.confidence}
                </span>
              </div>

              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-500 uppercase tracking-wide">Project Name</label>
                  <p className="text-sm font-medium text-slate-900">{parsedData.name || '—'}</p>
                </div>
                <div>
                  <label className="text-xs text-slate-500 uppercase tracking-wide">Client</label>
                  <p className="text-sm font-medium text-slate-900">{parsedData.client || '—'}</p>
                </div>
                <div>
                  <label className="text-xs text-slate-500 uppercase tracking-wide">Project Type</label>
                  <p className="text-sm font-medium text-slate-900">{parsedData.project_type || '—'}</p>
                </div>
                <div>
                  <label className="text-xs text-slate-500 uppercase tracking-wide">CMS</label>
                  <p className="text-sm font-medium text-slate-900">{parsedData.cms || '—'}</p>
                </div>
                <div>
                  <label className="text-xs text-slate-500 uppercase tracking-wide">Offer Value</label>
                  <p className="text-sm font-medium text-slate-900">
                    {parsedData.offer_value ? `€${parsedData.offer_value.toLocaleString()}` : '—'}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-slate-500 uppercase tracking-wide">Integrations</label>
                  <p className="text-sm font-medium text-slate-900">{parsedData.integrations || '—'}</p>
                </div>
              </div>

              {/* Brief Summary */}
              {parsedData.brief_summary && (
                <div>
                  <label className="text-xs text-slate-500 uppercase tracking-wide">Brief Summary</label>
                  <p className="text-sm text-slate-700 mt-1">{parsedData.brief_summary}</p>
                </div>
              )}

              {/* Profile Hours */}
              <div>
                <label className="text-xs text-slate-500 uppercase tracking-wide mb-2 block">Estimated Hours by Profile</label>
                <div className="grid grid-cols-4 gap-2">
                  {PROFILES.map((profile) => {
                    const hours = parsedData.profile_hours.find(ph => ph.profile === profile);
                    return (
                      <div key={profile} className="bg-slate-50 rounded-lg p-3 text-center">
                        <div className="text-xs text-slate-500">{profile}</div>
                        <div className="text-lg font-semibold text-slate-900">
                          {hours?.estimated_hours || 0}h
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-2 text-right">
                  <span className="text-sm text-slate-600">Total: </span>
                  <span className="text-sm font-semibold text-slate-900">
                    {parsedData.profile_hours.reduce((sum, ph) => sum + ph.estimated_hours, 0)}h
                  </span>
                </div>
              </div>

              {/* Scope Items */}
              {parsedData.scope_items.length > 0 && (
                <div>
                  <label className="text-xs text-slate-500 uppercase tracking-wide mb-2 block">Scope Items</label>
                  <div className="bg-slate-50 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-100">
                          <th className="text-left px-3 py-2 font-medium text-slate-600">Item</th>
                          <th className="text-left px-3 py-2 font-medium text-slate-600">Type</th>
                          <th className="text-right px-3 py-2 font-medium text-slate-600">Qty</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsedData.scope_items.map((item, i) => (
                          <tr key={i} className="border-t border-slate-200">
                            <td className="px-3 py-2 text-slate-900">{item.name}</td>
                            <td className="px-3 py-2 text-slate-600">{item.type}</td>
                            <td className="px-3 py-2 text-slate-900 text-right">{item.quantity}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
          {step === 'preview' && (
            <>
              <Button variant="secondary" onClick={() => setStep('upload')}>
                Upload Different File
              </Button>
              <Button onClick={handleApply}>
                <CheckCircle className="w-4 h-4" /> Apply to Project
              </Button>
            </>
          )}
          {step === 'upload' && (
            <Button variant="secondary" onClick={handleClose}>
              Cancel
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
