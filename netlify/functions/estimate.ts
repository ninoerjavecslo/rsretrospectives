import type { Handler, HandlerEvent } from '@netlify/functions';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

interface EstimateRequest {
  brief_text: string;
  project_type: string;
  cms: string;
  integrations: string;
  scope_items: {
    pages?: number;
    components?: number;
    templates?: number;
    integrations?: number;
    wireframes?: number;
  };
  historicalData: string; // JSON string of past projects
  profileStats: string; // JSON string of profile accuracy stats
}

const SYSTEM_PROMPT = `You are an expert project estimator for a digital agency. Your job is to estimate hours by profile based on a project brief and historical data.

Profiles available: UX, UI, DESIGN, DEV, PM, CONTENT, ANALYTICS

For each estimate, provide THREE scenarios:
- Optimistic: Best case, everything goes smoothly (20% under realistic)
- Realistic: Most likely outcome based on historical data
- Pessimistic: Worst case with scope creep and issues (30-50% over realistic)

Consider these factors:
1. Project type and complexity
2. CMS choice (custom = more hours)
3. Number of integrations
4. Scope items (pages, components, etc.)
5. Historical accuracy by profile (some profiles consistently underestimate)

Also provide:
- Risk factors (what could go wrong)
- Confidence level (low/medium/high based on how similar to past projects)
- Suggested price at 52% margin target

Respond ONLY with valid JSON in this exact format:
{
  "profiles": {
    "UX": { "optimistic": 10, "realistic": 15, "pessimistic": 22 },
    "UI": { "optimistic": 20, "realistic": 30, "pessimistic": 45 },
    "DESIGN": { "optimistic": 15, "realistic": 25, "pessimistic": 38 },
    "DEV": { "optimistic": 80, "realistic": 120, "pessimistic": 180 },
    "PM": { "optimistic": 10, "realistic": 15, "pessimistic": 22 },
    "CONTENT": { "optimistic": 5, "realistic": 8, "pessimistic": 12 },
    "ANALYTICS": { "optimistic": 3, "realistic": 5, "pessimistic": 8 }
  },
  "total": {
    "optimistic": 143,
    "realistic": 218,
    "pessimistic": 327
  },
  "suggested_price": {
    "optimistic": 22000,
    "realistic": 33500,
    "pessimistic": 50300
  },
  "confidence": "medium",
  "risks": [
    "CMS integrations often take longer than expected",
    "Similar projects had 20% scope creep on average"
  ],
  "reasoning": "Brief explanation of how you arrived at these numbers"
}`;

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
    const request = JSON.parse(event.body || '{}') as EstimateRequest;

    const userPrompt = `Please estimate this project:

PROJECT BRIEF:
${request.brief_text || 'No brief provided'}

PROJECT DETAILS:
- Type: ${request.project_type || 'Not specified'}
- CMS: ${request.cms || 'Not specified'}
- Integrations: ${request.integrations || 'None specified'}

SCOPE ITEMS:
- Pages: ${request.scope_items?.pages || 0}
- Components: ${request.scope_items?.components || 0}
- Templates: ${request.scope_items?.templates || 0}
- Integrations: ${request.scope_items?.integrations || 0}
- Wireframes: ${request.scope_items?.wireframes || 0}

HISTORICAL DATA FROM SIMILAR PROJECTS:
${request.historicalData || 'No historical data available'}

PROFILE ACCURACY STATS (how much each profile typically under/overestimates):
${request.profileStats || 'No profile stats available'}

Based on this information, provide your estimate in the JSON format specified.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3, // Lower temperature for more consistent estimates
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
    const content = data.choices?.[0]?.message?.content || '';

    // Try to parse the JSON response
    try {
      // Extract JSON from the response (in case there's extra text)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      const estimate = JSON.parse(jsonMatch[0]);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ estimate }),
      };
    } catch (parseError) {
      console.error('Failed to parse estimate:', content);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          estimate: null,
          raw: content,
          error: 'Failed to parse estimate response',
        }),
      };
    }
  } catch (error) {
    console.error('Estimate function error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

export { handler };
