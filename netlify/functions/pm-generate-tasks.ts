import type { Handler, HandlerEvent } from '@netlify/functions';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

interface GenerateTasksRequest {
  offer_text: string;
  additional_notes?: string;
  language?: 'en' | 'sl';
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
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  if (!OPENAI_API_KEY) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'OpenAI API key not configured' }),
    };
  }

  try {
    const request = JSON.parse(event.body || '{}') as GenerateTasksRequest;

    if (!request.offer_text || request.offer_text.trim().length < 50) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Offer text is required (minimum 50 characters)' }),
      };
    }

    const language = request.language || 'en';
    const systemPrompt = language === 'sl' ? SYSTEM_PROMPT_SL : SYSTEM_PROMPT_EN;

    // Truncate offer text if too long to speed up response
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
      console.error('OpenAI error:', error);
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ error: 'OpenAI API error' }),
      };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      const result = JSON.parse(jsonMatch[0]);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ result }),
      };
    } catch (parseError) {
      console.error('Failed to parse tasks:', content);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          result: null,
          raw: content,
          error: 'Failed to parse AI response',
        }),
      };
    }
  } catch (error) {
    console.error('PM generate tasks function error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

export { handler };
