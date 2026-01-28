import { useState, useEffect, useRef } from 'react';
import { Send, ThumbsUp, ThumbsDown, Loader2, Trash2, MessageSquare } from 'lucide-react';
import { Button, LoadingSpinner } from '../components/ui';
import { fetchProjectsWithMetrics, supabase } from '../lib/supabase';
import type { ProjectWithDetails, ProjectMetrics, AIMessage, AIConversation } from '../types';
import ReactMarkdown from 'react-markdown';

export function AIAssistant() {
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [projectsContext, setProjectsContext] = useState<string>('');
  const [conversations, setConversations] = useState<AIConversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadProjectsContext();
    loadConversations();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  async function loadProjectsContext() {
    try {
      const projects = await fetchProjectsWithMetrics();
      const context = buildProjectsContext(projects);
      setProjectsContext(context);
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      setLoadingProjects(false);
    }
  }

  async function loadConversations() {
    try {
      const { data } = await supabase
        .from('ai_conversations')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(20);
      setConversations(data || []);
    } catch (error) {
      console.error('Error loading conversations:', error);
    }
  }

  function buildProjectsContext(projects: (ProjectWithDetails & { metrics: ProjectMetrics })[]): string {
    if (projects.length === 0) return 'No projects in the system yet.';

    const summary = projects.map(p => {
      const profileHours = p.profile_hours.map(ph =>
        `${ph.profile}: ${ph.estimated_hours}h est / ${ph.actual_hours}h actual`
      ).join(', ');

      return `
PROJECT: ${p.name}
- Client: ${p.client}
- Type: ${p.project_type}, CMS: ${p.cms}
- Status: ${p.status}
- Value: €${p.metrics.totalValue.toLocaleString()}
- Hours: ${p.metrics.estimatedHours}h estimated, ${p.metrics.actualHours}h actual (${p.metrics.hoursVariancePercent.toFixed(0)}% variance)
- Margin: ${p.metrics.estimatedMargin.toFixed(0)}% est, ${p.metrics.actualMargin.toFixed(0)}% actual
- Health: ${p.metrics.health}
- Scope Creep: ${p.scope_creep ? 'Yes - ' + p.scope_creep_notes : 'No'}
- Went Well: ${p.went_well || 'Not documented'}
- Went Wrong: ${p.went_wrong || 'Not documented'}
- Hours by Profile: ${profileHours}
`;
    }).join('\n---\n');

    // Add aggregate stats
    const completedProjects = projects.filter(p => p.metrics.actualHours > 0);
    const avgMargin = completedProjects.length > 0
      ? completedProjects.reduce((sum, p) => sum + p.metrics.actualMargin, 0) / completedProjects.length
      : 0;
    const scopeCreepRate = projects.filter(p => p.scope_creep).length / projects.length * 100;

    return `AGGREGATE STATS:
- Total Projects: ${projects.length}
- Average Actual Margin: ${avgMargin.toFixed(0)}%
- Scope Creep Rate: ${scopeCreepRate.toFixed(0)}%
- Target Margin: 50-55%

INDIVIDUAL PROJECTS:
${summary}`;
  }

  async function handleSend() {
    if (!input.trim() || loading) return;

    const userMessage: AIMessage = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/.netlify/functions/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          projectsContext,
        }),
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      const assistantMessage: AIMessage = {
        role: 'assistant',
        content: data.message,
        timestamp: new Date().toISOString(),
      };

      const updatedMessages = [...newMessages, assistantMessage];
      setMessages(updatedMessages);

      // Save conversation
      await saveConversation(updatedMessages);
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: AIMessage = {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date().toISOString(),
      };
      setMessages([...newMessages, errorMessage]);
    } finally {
      setLoading(false);
    }
  }

  async function saveConversation(msgs: AIMessage[]) {
    try {
      const title = msgs[0]?.content.slice(0, 50) + (msgs[0]?.content.length > 50 ? '...' : '');

      if (currentConversationId) {
        await supabase
          .from('ai_conversations')
          .update({ messages: msgs, updated_at: new Date().toISOString() })
          .eq('id', currentConversationId);
      } else {
        const { data } = await supabase
          .from('ai_conversations')
          .insert([{ title, messages: msgs }])
          .select()
          .single();
        if (data) {
          setCurrentConversationId(data.id);
        }
      }
      loadConversations();
    } catch (error) {
      console.error('Error saving conversation:', error);
    }
  }

  async function loadConversation(conv: AIConversation) {
    setCurrentConversationId(conv.id);
    setMessages(conv.messages || []);
  }

  function startNewConversation() {
    setCurrentConversationId(null);
    setMessages([]);
  }

  async function deleteConversation(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await supabase.from('ai_conversations').delete().eq('id', id);
      if (currentConversationId === id) {
        startNewConversation();
      }
      loadConversations();
    } catch (error) {
      console.error('Error deleting conversation:', error);
    }
  }

  async function handleFeedback(messageIndex: number, rating: 'good' | 'bad') {
    if (!currentConversationId) return;
    try {
      await supabase.from('ai_feedback').insert([{
        conversation_id: currentConversationId,
        message_index: messageIndex,
        rating,
      }]);
    } catch (error) {
      console.error('Error saving feedback:', error);
    }
  }

  if (loadingProjects) {
    return (
      <div className="p-8">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-64px)]">
      {/* Sidebar - Conversation History */}
      <div className="w-72 bg-slate-50 border-r border-slate-200 flex flex-col">
        <div className="p-4 border-b border-slate-200">
          <Button onClick={startNewConversation} className="w-full">
            <MessageSquare className="w-4 h-4" /> New Chat
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {conversations.map((conv) => (
            <div
              key={conv.id}
              onClick={() => loadConversation(conv)}
              className={`p-3 rounded-lg cursor-pointer mb-1 group flex justify-between items-start ${
                currentConversationId === conv.id
                  ? 'bg-blue-100 text-blue-900'
                  : 'hover:bg-slate-100'
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{conv.title || 'New conversation'}</div>
                <div className="text-xs text-slate-400 mt-0.5">
                  {new Date(conv.updated_at).toLocaleDateString()}
                </div>
              </div>
              <button
                onClick={(e) => deleteConversation(conv.id, e)}
                className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 ml-2"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-white">
          <h1 className="text-lg font-semibold text-slate-900">AI Assistant</h1>
          <p className="text-sm text-slate-500">Ask questions about your projects, find patterns, get insights</p>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-700 mb-2">Start a conversation</h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
                Ask me anything about your projects. I have access to all your project data, metrics, and retrospectives.
              </p>
              <div className="flex flex-wrap gap-2 justify-center max-w-lg mx-auto">
                {[
                  'Which projects had the best margins?',
                  'What are common reasons for scope creep?',
                  'Which profiles tend to underestimate?',
                  'Compare our e-commerce projects',
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setInput(suggestion)}
                    className="px-3 py-1.5 text-sm bg-slate-100 hover:bg-slate-200 rounded-full text-slate-700"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[70%] rounded-2xl px-4 py-3 ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-900'
                }`}
              >
                {message.role === 'assistant' ? (
                  <div className="prose prose-sm max-w-none">
                    <ReactMarkdown>{message.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                )}

                {message.role === 'assistant' && (
                  <div className="flex gap-2 mt-2 pt-2 border-t border-slate-200">
                    <button
                      onClick={() => handleFeedback(index, 'good')}
                      className="text-slate-400 hover:text-emerald-500"
                      title="Good response"
                    >
                      <ThumbsUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleFeedback(index, 'bad')}
                      className="text-slate-400 hover:text-red-500"
                      title="Bad response"
                    >
                      <ThumbsDown className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-slate-100 rounded-2xl px-4 py-3">
                <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-slate-200 bg-white">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex gap-3"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your projects..."
              className="flex-1 px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={loading}
            />
            <Button type="submit" disabled={loading || !input.trim()}>
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
