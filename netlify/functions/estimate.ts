import type { Handler, HandlerEvent } from '@netlify/functions';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

interface EstimateRequest {
  brief_text: string;
  project_type: string;
  cms: string;
  integrations: string;
  historicalData: string;
  profileStats: string;
}

const SYSTEM_PROMPT = `You are an expert project estimator and discovery specialist for a digital agency. Your job is to analyze project briefs and provide comprehensive project analysis.

Profiles available: UX, UI, DESIGN, DEV, PM, CONTENT, ANALYTICS

Based on the brief, you must provide:

1. SUGGESTED TEMPLATES - Key pages/templates the project will need
2. CLIENT QUESTIONS - Important questions to clarify scope before estimating
3. RISKS - Potential issues and unknowns
4. HOUR ESTIMATES - Three scenarios (optimistic, realistic, pessimistic)

For hour estimates:
- Optimistic: Best case, everything goes smoothly (20% under realistic)
- Realistic: Most likely outcome based on experience
- Pessimistic: Worst case with scope creep and issues (30-50% over realistic)
- Internal hourly cost is €30, target margin is 52%

Respond ONLY with valid JSON in this exact format:
{
  "suggested_templates": [
    { "name": "Domača stran", "name_en": "Homepage", "included": true, "description": "Main landing page with hero, features, CTA" },
    { "name": "Produktna stran", "name_en": "Product page", "included": true, "description": "Individual product display with details" },
    { "name": "Kategorija", "name_en": "Category listing", "included": true, "description": "Product listing with filters" },
    { "name": "O nas", "name_en": "About", "included": true, "description": "Company information page" },
    { "name": "Kontakt", "name_en": "Contact", "included": true, "description": "Contact form and information" },
    { "name": "Blog / Novice", "name_en": "Blog / News", "included": false, "description": "Article listing and detail pages" },
    { "name": "Iskalnik", "name_en": "Search", "included": false, "description": "Search results page" },
    { "name": "Prijava", "name_en": "Login/Register", "included": false, "description": "User authentication pages" },
    { "name": "404 stran", "name_en": "404 page", "included": true, "description": "Error page" }
  ],
  "client_questions": {
    "content": [
      { "question": "Koliko produktov/kategorij bo na strani?", "question_en": "How many products/categories will be on the site?", "why": "Affects content migration and template complexity" },
      { "question": "Ali imate obstoječe vsebine ali jih je treba ustvariti?", "question_en": "Do you have existing content or does it need to be created?", "why": "Determines content creation hours" }
    ],
    "functionality": [
      { "question": "Ali potrebujete uporabniške račune?", "question_en": "Do you need user accounts?", "why": "Adds significant development complexity" },
      { "question": "Kakšen tip iskanja/filtriranja potrebujete?", "question_en": "What type of search/filtering do you need?", "why": "Can range from simple to very complex" }
    ],
    "design": [
      { "question": "Ali imate obstoječ brand manual?", "question_en": "Do you have an existing brand manual?", "why": "Affects design discovery phase" },
      { "question": "Koliko iteracij dizajna pričakujete?", "question_en": "How many design iterations do you expect?", "why": "More iterations = more UI hours" }
    ],
    "technical": [
      { "question": "Kje bo gostovana stran?", "question_en": "Where will the site be hosted?", "why": "Affects deployment and DevOps setup" },
      { "question": "Kakšne so zahteve glede GDPR/piškotkov?", "question_en": "What are the GDPR/cookie requirements?", "why": "Compliance work can add hours" }
    ]
  },
  "risks": [
    { "risk": "API integracija - kompleksnost odvisna od dokumentacije", "risk_en": "API integration - complexity depends on documentation", "severity": "medium" },
    { "risk": "Nejasno: B2B ali B2C?", "risk_en": "Unclear: B2B or B2C?", "severity": "high" }
  ],
  "profiles": {
    "UX": { "optimistic": 20, "realistic": 30, "pessimistic": 45 },
    "UI": { "optimistic": 35, "realistic": 50, "pessimistic": 70 },
    "DESIGN": { "optimistic": 10, "realistic": 15, "pessimistic": 25 },
    "DEV": { "optimistic": 80, "realistic": 120, "pessimistic": 170 },
    "PM": { "optimistic": 15, "realistic": 25, "pessimistic": 35 },
    "CONTENT": { "optimistic": 10, "realistic": 20, "pessimistic": 35 },
    "ANALYTICS": { "optimistic": 5, "realistic": 8, "pessimistic": 12 }
  },
  "total": {
    "optimistic": 175,
    "realistic": 268,
    "pessimistic": 392
  },
  "suggested_price": {
    "optimistic": 16500,
    "realistic": 25000,
    "pessimistic": 37000
  },
  "confidence": "medium",
  "reasoning": "Brief explanation of the analysis and key factors considered"
}

IMPORTANT:
- Adapt templates to project type (e-commerce needs cart/checkout, SaaS needs pricing/features, etc.)
- Questions should be specific to what's unclear in the brief
- Risks should highlight real unknowns that could affect scope
- Be thorough but practical`;

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

    const userPrompt = `Analyze this project and provide comprehensive estimation:

PROJECT BRIEF:
${request.brief_text || 'No brief provided'}

PROJECT DETAILS:
- Type: ${request.project_type || 'Not specified'}
- CMS: ${request.cms || 'Not specified'}
- Integrations: ${request.integrations || 'None specified'}

HISTORICAL DATA FROM SIMILAR PROJECTS:
${request.historicalData || 'No historical data available'}

PROFILE ACCURACY STATS (typical under/overestimation):
${request.profileStats || 'No profile stats available'}

Based on this, provide:
1. Suggested templates/pages this project needs
2. Questions to clarify with the client before finalizing estimate
3. Potential risks and unknowns
4. Hour estimates by profile (3 scenarios)

Respond in the JSON format specified.`;

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
        temperature: 0.3,
        max_tokens: 4000,
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
