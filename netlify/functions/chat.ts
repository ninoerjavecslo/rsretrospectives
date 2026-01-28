import type { Handler, HandlerEvent } from '@netlify/functions';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

interface ChatRequest {
  messages: { role: 'user' | 'assistant' | 'system'; content: string }[];
  projectsContext: string;
}

const SYSTEM_PROMPT = `You are an AI assistant for a project retrospectives and intelligence tool used by a digital agency.

Your role is to help users:
- Analyze project performance and margins
- Identify patterns in estimation accuracy
- Understand why projects went over/under budget
- Find insights from retrospectives (what went well/wrong)
- Compare similar projects
- Suggest improvements based on historical data

Key metrics to understand:
- Target margin: 50-55% is success
- Internal hourly cost: €30
- Profiles: UX, UI, DESIGN, DEV, PM, CONTENT, ANALYTICS
- Hours variance: (actual - estimated) / estimated * 100

When answering:
- Be concise and actionable
- Reference specific projects when relevant
- Highlight patterns and trends
- Suggest concrete improvements
- Use data to support your points

The user will provide context about their projects in each message.`;

const handler: Handler = async (event: HandlerEvent) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  // Handle preflight
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
    const { messages, projectsContext } = JSON.parse(event.body || '{}') as ChatRequest;

    if (!messages || !Array.isArray(messages)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Messages array required' }),
      };
    }

    // Build messages with system prompt and context
    const systemMessage = {
      role: 'system' as const,
      content: `${SYSTEM_PROMPT}\n\n--- CURRENT PROJECTS DATA ---\n${projectsContext}`,
    };

    const openaiMessages = [systemMessage, ...messages];

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: openaiMessages,
        temperature: 0.7,
        max_tokens: 2000,
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
    const assistantMessage = data.choices?.[0]?.message?.content || 'No response';

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: assistantMessage }),
    };
  } catch (error) {
    console.error('Chat function error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

export { handler };
