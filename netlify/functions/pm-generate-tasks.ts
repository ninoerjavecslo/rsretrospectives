import type { Handler, HandlerEvent } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

interface GenerateTasksRequest {
  offer_text: string;
  additional_notes?: string;
  language?: 'en' | 'sl';
  job_id?: string; // For polling
}

const SYSTEM_PROMPT_EN = `You are a project manager. Analyze project offers and create Jira tasks.

Output JSON only:
{"detected_project_name":"Name","tasks":[{"summary":"Task name","description":"Details\\n\\nAcceptance Criteria:\\n- Item","task_type":"Epic|Story|Task|Subtask","priority":"Highest|High|Medium|Low","labels":["discovery|design|development|content|qa|launch","ux|ui|dev|pm|content"],"parent_ref":"Parent task name if subtask","order":1}],"summary":{"total_tasks":10,"by_type":{"Epic":2,"Story":4,"Task":3,"Subtask":1},"by_priority":{"High":5,"Medium":5}},"recommendations":["Tip 1"]}

Rules:
- Task types: Epic (phases), Story (user features), Task (technical work), Subtask
- Include acceptance criteria IN description
- Cover: discovery, UX, UI, development, QA, launch phases
- Generate 15-30 tasks for typical projects`;

const SYSTEM_PROMPT_SL = `Si projektni vodja. Analiziraj ponudbe in ustvari Jira naloge V SLOVENŠČINI.

Izpiši samo JSON:
{"detected_project_name":"Ime","tasks":[{"summary":"Ime naloge","description":"Podrobnosti\\n\\nKriteriji sprejemljivosti:\\n- Element","task_type":"Epic|Story|Task|Subtask","priority":"Highest|High|Medium|Low","labels":["discovery|design|development|content|qa|launch","ux|ui|dev|pm|content"],"parent_ref":"Ime nadrejene naloge","order":1}],"summary":{"total_tasks":10,"by_type":{"Epic":2,"Story":4,"Task":3,"Subtask":1},"by_priority":{"High":5,"Medium":5}},"recommendations":["Nasvet 1"]}

Pravila:
- Tipi: Epic (faze), Story (funkcije), Task (tehnično delo), Subtask
- Kriteriji sprejemljivosti V opisu
- Pokrij: discovery, UX, UI, razvoj, QA, launch
- Generiraj 15-30 nalog`;

const handler: Handler = async (event: HandlerEvent) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  if (!OPENAI_API_KEY) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'OpenAI API key not configured' }) };
  }

  try {
    const request = JSON.parse(event.body || '{}') as GenerateTasksRequest;

    // If job_id is provided, this is a poll request
    if (request.job_id) {
      const { data, error } = await supabase
        .from('pm_jobs')
        .select('*')
        .eq('id', request.job_id)
        .single();

      if (error || !data) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Job not found' }) };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          status: data.status,
          result: data.result,
          error: data.error_message,
        }),
      };
    }

    // Validate input
    if (!request.offer_text || request.offer_text.trim().length < 50) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Offer text is required (minimum 50 characters)' }) };
    }

    // Create a job record
    const { data: job, error: jobError } = await supabase
      .from('pm_jobs')
      .insert({ status: 'pending', offer_text: request.offer_text.slice(0, 3000) })
      .select()
      .single();

    if (jobError || !job) {
      console.error('Failed to create job:', jobError);
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to create job' }) };
    }

    // Return job ID immediately - process in background
    // Note: We'll process synchronously but return early by not awaiting
    const jobId = job.id;

    // Process the request (this will complete after we return)
    processJob(jobId, request).catch(err => console.error('Job processing error:', err));

    return {
      statusCode: 202,
      headers,
      body: JSON.stringify({ job_id: jobId, status: 'pending' }),
    };

  } catch (error) {
    console.error('PM generate tasks function error:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};

async function processJob(jobId: string, request: GenerateTasksRequest) {
  try {
    const language = request.language || 'en';
    const systemPrompt = language === 'sl' ? SYSTEM_PROMPT_SL : SYSTEM_PROMPT_EN;
    const offerText = request.offer_text.slice(0, 3000);

    const userPrompt = `Project offer:\n${offerText}\n${request.additional_notes ? `\nNotes: ${request.additional_notes}` : ''}\n\nGenerate Jira tasks JSON.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
        max_tokens: 3000,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      await supabase.from('pm_jobs').update({ status: 'error', error_message: 'OpenAI API error' }).eq('id', jobId);
      return;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      await supabase.from('pm_jobs').update({ status: 'error', error_message: 'Failed to parse AI response' }).eq('id', jobId);
      return;
    }

    const result = JSON.parse(jsonMatch[0]);
    await supabase.from('pm_jobs').update({ status: 'completed', result }).eq('id', jobId);

  } catch (error) {
    console.error('Process job error:', error);
    await supabase.from('pm_jobs').update({
      status: 'error',
      error_message: error instanceof Error ? error.message : 'Unknown error'
    }).eq('id', jobId);
  }
}

export { handler };
